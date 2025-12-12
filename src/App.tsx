import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { Agent, AgentDiffStat, BranchInfo } from "./types/agent";
import { RepoStatusDto } from "./types/git";
import {
  PaneNode,
  PaneMeta,
  LayoutNode,
  collectPanes,
  countPanes,
  findPane,
  getFirstPane,
  removePane,
  buildLayoutFromPanes,
  createId,
} from "./types/layout";
import { LayoutRenderer } from "./components/LayoutRenderer";
import { SyncBar } from "./components/SyncBar";
import { AgentOverview } from "./components/AgentOverview";
const LAST_REPO_KEY = "parallel:lastRepo";
const LAST_BRANCH_KEY = "parallel:lastBranch";

function formatInvokeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
    const maybeError = (error as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim()) return maybeError;
  }
  return "Unexpected error.";
}

async function createPaneNode(
  opts?: { cwd?: string; meta?: PaneMeta }
): Promise<PaneNode> {
  const sessionId = await invoke<string>("create_session", {
    cwd: opts?.cwd,
  });
  return {
    type: "pane",
    id: createId(),
    sessionId,
    meta: opts?.meta,
  };
}
function App() {
  const [layout, setLayout] = useState<LayoutNode | null>(null);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [syncTyping, setSyncTyping] = useState(false);
  const [repoStatus, setRepoStatus] = useState<RepoStatusDto | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoLoading, setRepoLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentDiffStats, setAgentDiffStats] = useState<Record<string, AgentDiffStat>>({});
  const [baseBranch, setBaseBranch] = useState<string | null>(null);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentNameInput, setAgentNameInput] = useState("");
  const [agentCommandInput, setAgentCommandInput] = useState("");
  const [agentError, setAgentError] = useState<string | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentMenuOpenId, setAgentMenuOpenId] = useState<string | null>(null);
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchOptions, setBranchOptions] = useState<BranchInfo[]>([]);
  const [branchSelection, setBranchSelection] = useState<string>("");
  const [pendingRepoPath, setPendingRepoPath] = useState<string | null>(null);
  const hasRestoredRepo = useRef(false);

  const resetLayoutState = useCallback(() => {
    setLayout(null);
    setActivePaneId(null);
    setSyncTyping(false);
  }, []);

  const resetAgentsState = useCallback(() => {
    setAgents([]);
    setAgentMenuOpenId(null);
    setRemovingAgentId(null);
    setAgentDiffStats({});
  }, []);

  const resetRepoState = useCallback(() => {
    setRepoStatus(null);
    setBaseBranch(null);
  }, []);

  const runStartCommand = useCallback(async (pane: PaneNode, command: string) => {
    if (!command.trim()) return;
    const commandToRun = command.endsWith("\n") ? command : `${command}\n`;
    await invoke("write_to_session", { id: pane.sessionId, data: commandToRun });
  }, []);

  const killLayoutSessions = useCallback(async (node: LayoutNode | null) => {
    const panes = collectPanes(node);
    await Promise.all(
      panes.map((pane) =>
        invoke("kill_session", { id: pane.sessionId }).catch(() => undefined)
      )
    );
  }, []);

  const launchAgentPanes = useCallback(
    async (agentList: Agent[]) => {
      await killLayoutSessions(layout);
      if (!agentList.length) {
        resetLayoutState();
        return;
      }

      const panesWithAgents: { pane: PaneNode; agent: Agent }[] = [];
      for (const agent of agentList) {
        const pane = await createPaneNode({
          cwd: agent.worktree_path,
          meta: {
            agentId: agent.id,
            agentName: agent.name,
            branchName: agent.branch_name,
            worktreePath: agent.worktree_path,
          },
        });
        panesWithAgents.push({ pane, agent });
      }
      const panes = panesWithAgents.map(({ pane }) => pane);
      const nextLayout = buildLayoutFromPanes(panes);
      setLayout(nextLayout);
      setActivePaneId(panes[0]?.id ?? null);
      setSyncTyping(false);
      await Promise.all(
        panesWithAgents.map(({ pane, agent }) =>
          runStartCommand(pane, agent.start_command).catch((error) => {
            console.error("Failed to run start command for agent", agent.id, error);
          })
        )
      );
    },
    [killLayoutSessions, layout, runStartCommand]
  );

  const refreshAgentDiffStats = useCallback(async (repoRoot: string) => {
    if (!repoRoot) {
      setAgentDiffStats({});
      return;
    }

    try {
      const summaries = await invoke<AgentDiffStat[]>("agent_diff_stats", { repoRoot });
      const mapped = summaries.reduce<Record<string, AgentDiffStat>>((acc, item) => {
        acc[item.agent_id] = item;
        return acc;
      }, {});
      setAgentDiffStats(mapped);
    } catch (error) {
      console.error("Failed to load agent diff stats", error);
      setAgentDiffStats({});
    }
  }, []);

  const loadAgentsForRepo = useCallback(
    async (repoRoot: string) => {
      try {
        const loaded = await invoke<Agent[]>("list_agents", { repoRoot });
        setAgents(loaded);
        setAgentMenuOpenId(null);
        setRemovingAgentId(null);
        await launchAgentPanes(loaded);
        await refreshAgentDiffStats(repoRoot);
      } catch (error) {
        console.error("Failed to load agents", error);
        resetAgentsState();
        await killLayoutSessions(layout);
        resetLayoutState();
      }
    },
    [killLayoutSessions, launchAgentPanes, layout, refreshAgentDiffStats, resetAgentsState, resetLayoutState]
  );

  const bindRepoPath = useCallback(
    async (repoRoot: string, branchName: string, silent?: boolean) => {
      if (!repoRoot || !branchName) return;
      setRepoError(null);
      setRepoLoading(true);
      setAgentDiffStats({});
      try {
        const detected = await invoke<string | null>("git_detect_repo", { cwd: repoRoot });
        if (!detected) {
          resetRepoState();
          resetAgentsState();
          if (!silent) {
            setRepoError("Selected folder is not inside a git repository.");
          }
          await killLayoutSessions(layout);
          resetLayoutState();
          return;
        }

        const status = await invoke<RepoStatusDto>("git_status", { cwd: detected });
        const statusWithBranch = { ...status, branch: branchName };
        setRepoStatus(statusWithBranch);
        setBaseBranch(branchName);
        setRepoError(null);
        localStorage.setItem(LAST_REPO_KEY, detected);
        localStorage.setItem(LAST_BRANCH_KEY, branchName);
        await loadAgentsForRepo(detected);
      } catch (error) {
        if (!silent) {
          setRepoError(formatInvokeError(error) || "Failed to bind git repo.");
          resetRepoState();
          resetAgentsState();
          await killLayoutSessions(layout);
          resetLayoutState();
        }
      } finally {
        setRepoLoading(false);
      }
    },
    [killLayoutSessions, layout, loadAgentsForRepo, resetAgentsState, resetLayoutState, resetRepoState]
  );

  const handleBindRepo = useCallback(async () => {
    setRepoError(null);
    setBranchOptions([]);
    setBranchSelection("");
    setPendingRepoPath(null);
    let pickedPath: string | null = null;
    try {
      const selection = await open({
        directory: true,
        multiple: false,
      });
      pickedPath = Array.isArray(selection) ? selection[0] : selection;
    } catch (error) {
      setRepoError(formatInvokeError(error) || "Failed to open folder picker.");
      return;
    }

    if (!pickedPath) return;

    try {
      const repoRoot = await invoke<string | null>("git_detect_repo", { cwd: pickedPath });
      if (!repoRoot) {
        setRepoError("Selected folder is not inside a git repository.");
        return;
      }
      const branches = await invoke<BranchInfo[]>("git_list_branches", { cwd: repoRoot });
      if (!branches.length) {
        setRepoError("No branches found in repository.");
        return;
      }
      setBranchOptions(branches);
      const current = branches.find((b) => b.current) ?? branches[0];
      setBranchSelection(current?.name ?? "");
      setPendingRepoPath(repoRoot);
      setBranchDialogOpen(true);
    } catch (error) {
      setRepoError(formatInvokeError(error) || "Failed to prepare branch selection.");
    }
  }, []);

  const handleConfirmBranch = useCallback(async () => {
    if (!pendingRepoPath || !branchSelection) {
      setRepoError("Select a branch to bind.");
      return;
    }
    setBranchDialogOpen(false);
    await bindRepoPath(pendingRepoPath, branchSelection);
    setPendingRepoPath(null);
  }, [bindRepoPath, branchSelection, pendingRepoPath]);

  const appendPaneForAgent = useCallback(
    (pane: PaneNode) => {
      setLayout((prev) => {
        const panes = collectPanes(prev);
        return buildLayoutFromPanes([...panes, pane]);
      });
      setActivePaneId(pane.id);
      setSyncTyping(false);
    },
    []
  );

  const toggleAgentMenu = useCallback((agentId: string) => {
    setAgentMenuOpenId((prev) => (prev === agentId ? null : agentId));
  }, []);

  const openAgentDialog = useCallback(() => {
    if (!repoStatus) {
      setRepoError("Bind a git repo before creating an agent.");
      return;
    }
    if (!agentNameInput) {
      setAgentNameInput(`agent-${agents.length + 1}`);
    }
    setAgentDialogOpen(true);
    setAgentError(null);
  }, [agentNameInput, agents.length, repoStatus]);

  const handleCreateAgent = useCallback(async () => {
    if (!repoStatus) {
      setAgentError("Bind a git repo before creating an agent.");
      return;
    }

    const name = agentNameInput.trim();
    const startCommand = agentCommandInput.trim();

    if (!name) {
      setAgentError("Add an agent name.");
      return;
    }

    if (!startCommand) {
      setAgentError("Add a starting command.");
      return;
    }

    setCreatingAgent(true);
    setAgentError(null);
    try {
      const branchForAgent = baseBranch ?? repoStatus.branch;
      const agent = await invoke<Agent>("create_agent", {
        repoRoot: repoStatus.root_path,
        name,
        startCommand,
        baseBranch: branchForAgent,
      });
      setAgents((prev) => [...prev, agent]);
      setAgentDiffStats((prev) => ({
        ...prev,
        [agent.id]: {
          agent_id: agent.id,
          files_changed: 0,
          insertions: 0,
          deletions: 0,
        },
      }));
      const pane = await createPaneNode({
        cwd: agent.worktree_path,
        meta: {
          agentId: agent.id,
          agentName: agent.name,
          branchName: agent.branch_name,
          worktreePath: agent.worktree_path,
        },
      });
      appendPaneForAgent(pane);
      await runStartCommand(pane, agent.start_command);
      await refreshAgentDiffStats(repoStatus.root_path);
      setAgentDialogOpen(false);
      setAgentNameInput("");
      setAgentCommandInput("");
    } catch (error) {
      setAgentError(formatInvokeError(error) || "Failed to create agent.");
    } finally {
      setCreatingAgent(false);
    }
  }, [
    agentCommandInput,
    agentNameInput,
    baseBranch,
    appendPaneForAgent,
    refreshAgentDiffStats,
    repoStatus,
    runStartCommand,
  ]);

  const handleRemoveAgent = useCallback(
    async (agent: Agent) => {
      if (!repoStatus) {
        setRepoError("Bind a git repo before removing an agent.");
        return;
      }

      setRemovingAgentId(agent.id);
      setRepoError(null);
      const panesForAgent = collectPanes(layout).filter(
        (pane) => pane.meta?.agentId === agent.id
      );

      try {
        await invoke("remove_agent", {
          repoRoot: repoStatus.root_path,
          agentId: agent.id,
        });
      } catch (error) {
        setRepoError(formatInvokeError(error) || "Failed to remove agent.");
        setRemovingAgentId(null);
        return;
      }

      await Promise.all(
        panesForAgent.map((pane) =>
          invoke("kill_session", { id: pane.sessionId }).catch(() => undefined)
        )
      );

      setLayout((prev) => {
        if (!prev) return prev;
        let next: LayoutNode | null = prev;
        for (const pane of panesForAgent) {
          if (!next) break;
          next = removePane(next, pane.id);
        }
        const fallbackPane = getFirstPane(next);
        setActivePaneId((currentActive) => {
          if (!currentActive) return fallbackPane?.id ?? null;
          if (panesForAgent.some((pane) => pane.id === currentActive)) {
            return fallbackPane?.id ?? null;
          }
          return currentActive;
        });
        setSyncTyping(false);
        return next;
      });
      setAgents((prev) => prev.filter((item) => item.id !== agent.id));
      setAgentDiffStats((prev) => {
        const { [agent.id]: _removed, ...rest } = prev;
        return rest;
      });
      setAgentMenuOpenId((current) => (current === agent.id ? null : current));
      setRemovingAgentId(null);
    },
    [layout, repoStatus]
  );

  const handleShowDiff = useCallback(
    async (agent: Agent) => {
      if (!repoStatus) {
        setRepoError("Bind a git repo before opening a diff view.");
        return;
      }

      try {
        await invoke("open_diff_between_refs", {
          worktreePath: agent.worktree_path,
          path: null,
        });
        setAgentMenuOpenId(null);
      } catch (error) {
        setRepoError(formatInvokeError(error) || "Failed to open diff view.");
      }
    },
    [repoStatus]
  );

  const closeActivePane = useCallback(async () => {
    if (!layout || !activePaneId) return;
    if (countPanes(layout) === 1) return;

    const paneToRemove = findPane(layout, activePaneId);
    if (paneToRemove) {
      await invoke("kill_session", { id: paneToRemove.sessionId });
    }

    setLayout((prev) => {
      if (!prev) return prev;
      const next = removePane(prev, activePaneId);
      if (!next) return prev;
      const fallbackPane = getFirstPane(next);
      setActivePaneId(fallbackPane?.id ?? null);
      setSyncTyping(false);
      return next;
    });
  }, [activePaneId, layout]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;
      if (event.code === "KeyW") {
        event.preventDefault();
        void closeActivePane();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeActivePane]);

  useEffect(() => {
    const handleWindowClick = () => setAgentMenuOpenId(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAgentMenuOpenId(null);
      }
    };

    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (hasRestoredRepo.current) return;
    const storedRepo = localStorage.getItem(LAST_REPO_KEY);
    const storedBranch = localStorage.getItem(LAST_BRANCH_KEY);
    hasRestoredRepo.current = true;
    if (storedRepo) {
      const restore = async () => {
        try {
          const repoRoot = await invoke<string | null>("git_detect_repo", { cwd: storedRepo });
          if (!repoRoot) return;
          let branch = storedBranch;
          if (!branch) {
            const branches = await invoke<BranchInfo[]>("git_list_branches", { cwd: repoRoot });
            const current = branches.find((b) => b.current) ?? branches[0];
            branch = current?.name ?? null;
          }
          if (branch) {
            await bindRepoPath(repoRoot, branch, true);
          }
        } catch (error) {
          console.error("Failed to restore repo binding", error);
        }
      };
      void restore();
    }
  }, [bindRepoPath]);

  const handleQuit = useCallback(() => {
    void getCurrentWindow().close();
  }, []);

  const handleClearCachesAndQuit = useCallback(async () => {
    const repoIds = new Set<string>();

    if (repoStatus?.root_path) {
      repoIds.add(repoStatus.root_path);
    }

    const lastRepo = localStorage.getItem(LAST_REPO_KEY);
    if (lastRepo) {
      repoIds.add(lastRepo);
    }

    await Promise.all(
      Array.from(repoIds).map(async (repoRoot) => {
        try {
          await invoke("cleanup_agents", { repoRoot });
        } catch (error) {
          console.error("Failed to cleanup agents for repo", repoRoot, error);
        }
      })
    );

    await killLayoutSessions(layout);
    localStorage.removeItem(LAST_REPO_KEY);
    localStorage.removeItem(LAST_BRANCH_KEY);
    setBaseBranch(null);
    void getCurrentWindow().close();
  }, [killLayoutSessions, layout, repoStatus]);

  return (
    <main className="app-shell">
      <SyncBar
        syncEnabled={syncTyping}
        onToggleSync={() => setSyncTyping((prev) => !prev)}
        onBindRepo={() => void handleBindRepo()}
        repoStatus={repoStatus}
        repoError={repoError}
        repoLoading={repoLoading}
      onCreateAgent={openAgentDialog}
      onQuit={handleQuit}
      onClearCachesAndQuit={handleClearCachesAndQuit}
    />
      <AgentOverview
        agents={agents}
        diffStats={agentDiffStats}
        openMenuId={agentMenuOpenId}
        onToggleMenu={toggleAgentMenu}
        onShowDiff={(agent) => void handleShowDiff(agent)}
        onRemoveAgent={(agent) => void handleRemoveAgent(agent)}
        removingAgentId={removingAgentId}
      />
      <section className="terminal-card">
        {layout ? (
          <div className="layout-root">
            <LayoutRenderer
              node={layout}
              activePaneId={activePaneId}
              onFocusPane={setActivePaneId}
              onPaneInput={
                syncTyping
                  ? (pane, data) => {
                      const targetSessions = collectPanes(layout)
                        .map((p) => p.sessionId)
                        .filter((id) => id !== pane.sessionId);
                      if (!targetSessions.length) return;
                      targetSessions.forEach((id) => {
                        void invoke("write_to_session", { id, data });
                      });
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="loading">No terminals yet. Create an agent to start.</div>
        )}
      </section>
      {branchDialogOpen ? (
        <div
          className="agent-dialog-backdrop"
          onClick={() => {
            if (!repoLoading) {
              setBranchDialogOpen(false);
              setPendingRepoPath(null);
            }
          }}
        >
          <div
            className="agent-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="agent-dialog-header">
              <h3>Select branch to bind</h3>
              <p className="muted">
                Bind to a branch; agent worktrees will merge back into this branch.
              </p>
            </div>
            <label className="field">
              <span>Branch</span>
              <select
                value={branchSelection}
                onChange={(event) => setBranchSelection(event.target.value)}
                disabled={repoLoading}
              >
                {branchOptions.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                    {branch.current ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="dialog-actions">
              <button
                className="chip"
                onClick={() => {
                  setBranchDialogOpen(false);
                  setPendingRepoPath(null);
                }}
                disabled={repoLoading}
              >
                Cancel
              </button>
              <button
                className="chip primary"
                onClick={() => void handleConfirmBranch()}
                disabled={repoLoading || !branchSelection || !pendingRepoPath}
              >
                Bind repo
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {agentDialogOpen ? (
        <div
          className="agent-dialog-backdrop"
          onClick={() => {
            if (!creatingAgent) setAgentDialogOpen(false);
          }}
        >
          <div
            className="agent-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="agent-dialog-header">
              <h3>Create new agent</h3>
              <p className="muted">
                Creates a worktree in {repoStatus?.root_path ?? "your repo"} and runs the start command.
              </p>
            </div>
            <label className="field">
              <span>Agent name</span>
              <input
                value={agentNameInput}
                onChange={(e) => setAgentNameInput(e.target.value)}
                placeholder={`agent-${agents.length + 1}`}
              />
            </label>
            <label className="field">
              <span>Starting command</span>
              <input
                value={agentCommandInput}
                onChange={(e) => setAgentCommandInput(e.target.value)}
                placeholder="npm start"
              />
            </label>
            {agentError ? <div className="agent-error">{agentError}</div> : null}
            <div className="dialog-actions">
              <button
                className="chip"
                onClick={() => setAgentDialogOpen(false)}
                disabled={creatingAgent}
              >
                Cancel
              </button>
              <button
                className="chip primary"
                onClick={() => void handleCreateAgent()}
                disabled={creatingAgent}
              >
                {creatingAgent ? "Creating..." : "Create agent"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
