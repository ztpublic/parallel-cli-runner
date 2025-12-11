import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./App.css";
import { Agent, AgentDiffStat } from "./types/agent";

type SessionData = {
  id: string;
  data: string;
};

type Orientation = "vertical" | "horizontal";

type PaneNode = {
  type: "pane";
  id: string;
  sessionId: string;
  meta?: PaneMeta;
};

type SplitNode = {
  type: "split";
  id: string;
  orientation: Orientation;
  children: [LayoutNode, LayoutNode];
};

type LayoutNode = PaneNode | SplitNode;

type PaneMeta = {
  agentId?: string;
  agentName?: string;
  branchName?: string;
  worktreePath?: string;
};

const createId = () => crypto.randomUUID();
const LAST_REPO_KEY = "parallel:lastRepo";

type FileChangeType = "added" | "modified" | "deleted" | "renamed" | "unmerged";

type FileStatusDto = {
  path: string;
  staged: FileChangeType | null;
  unstaged: FileChangeType | null;
};

type CommitInfoDto = {
  id: string;
  summary: string;
  author: string;
  relative_time: string;
};

type RepoStatusDto = {
  repo_id: string;
  root_path: string;
  branch: string;
  ahead: number;
  behind: number;
  has_untracked: boolean;
  has_staged: boolean;
  has_unstaged: boolean;
  conflicted_files: number;
  modified_files: FileStatusDto[];
  latest_commit: CommitInfoDto | null;
};

function countPanes(node: LayoutNode | null): number {
  if (!node) return 0;
  if (node.type === "pane") return 1;
  return countPanes(node.children[0]) + countPanes(node.children[1]);
}

function findPane(node: LayoutNode | null, paneId: string): PaneNode | null {
  if (!node) return null;
  if (node.type === "pane") return node.id === paneId ? node : null;
  return (
    findPane(node.children[0], paneId) ||
    findPane(node.children[1], paneId)
  );
}

function getFirstPane(node: LayoutNode | null): PaneNode | null {
  if (!node) return null;
  if (node.type === "pane") return node;
  return getFirstPane(node.children[0]) ?? getFirstPane(node.children[1]);
}

function collectPanes(node: LayoutNode | null, acc: PaneNode[] = []): PaneNode[] {
  if (!node) return acc;
  if (node.type === "pane") {
    acc.push(node);
    return acc;
  }
  collectPanes(node.children[0], acc);
  collectPanes(node.children[1], acc);
  return acc;
}

function removePane(
  node: LayoutNode,
  targetPaneId: string
): LayoutNode | null {
  if (node.type === "pane") {
    return node.id === targetPaneId ? null : node;
  }

  const nextLeft = removePane(node.children[0], targetPaneId);
  const nextRight = removePane(node.children[1], targetPaneId);

  if (!nextLeft && !nextRight) {
    return null;
  }
  if (!nextLeft) {
    return nextRight;
  }
  if (!nextRight) {
    return nextLeft;
  }

  return { ...node, children: [nextLeft, nextRight] };
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

type TerminalPaneProps = {
  pane: PaneNode;
  isActive: boolean;
  onFocused: (id: string) => void;
  onInput?: (pane: PaneNode, data: string) => void;
};

function TerminalPane({ pane, isActive, onFocused, onInput }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onInputRef = useRef(onInput);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  const syncSize = useCallback(async () => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    fitAddon.fit();
    const cols = term.cols;
    const rows = term.rows;
    await invoke("resize_session", { id: pane.sessionId, cols, rows });
  }, [pane.sessionId]);

  useEffect(() => {
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 14,
      disableStdin: false,
      theme: {
        background: "#0b1021",
      },
    });
    const fitAddon = new FitAddon();
    termRef.current = term;
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    if (containerRef.current) {
      term.open(containerRef.current);
    }

    const unsubscribeData = term.onData((data) => {
      void invoke("write_to_session", { id: pane.sessionId, data });
      if (onInputRef.current) {
        onInputRef.current(pane, data);
      }
    });

    let unlisten: (() => void) | undefined;
    listen<SessionData>("session-data", (event) => {
      if (event.payload.id === pane.sessionId) {
        term.write(event.payload.data);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    void syncSize();

    const resizeObserver = new ResizeObserver(() => {
      void syncSize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", syncSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncSize);
      unsubscribeData.dispose();
      term.dispose();
      if (unlisten) {
        unlisten();
      }
    };
  }, [pane.sessionId, syncSize]);

  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  return (
    <div
      className={`pane ${isActive ? "pane-active" : ""}`}
      ref={containerRef}
      tabIndex={0}
      onClick={() => onFocused(pane.id)}
    >
      <div className="pane-label" aria-hidden>
        <div className="pane-label-primary">
          {pane.meta?.agentName ?? pane.meta?.agentId ?? "Pane"}
        </div>
        {pane.meta?.branchName ? (
          <div className="pane-label-sub">{pane.meta.branchName}</div>
        ) : pane.meta?.worktreePath ? (
          <div className="pane-label-sub">{pane.meta.worktreePath}</div>
        ) : null}
      </div>
    </div>
  );
}

type LayoutRendererProps = {
  node: LayoutNode;
  activePaneId: string | null;
  onFocusPane: (id: string) => void;
  onPaneInput?: (pane: PaneNode, data: string) => void;
};

function LayoutRenderer({
  node,
  activePaneId,
  onFocusPane,
  onPaneInput,
}: LayoutRendererProps) {
  if (node.type === "pane") {
    return (
      <TerminalPane
        pane={node}
        isActive={node.id === activePaneId}
        onFocused={onFocusPane}
        onInput={onPaneInput}
      />
    );
  }

  const direction =
    node.orientation === "vertical" ? "split-vertical" : "split-horizontal";

  return (
    <div className={`split ${direction}`}>
      {node.children.map((child) => (
        <div
          key={child.id}
          className="split-child"
          style={{ flexGrow: countPanes(child) || 1 }}
        >
          <LayoutRenderer
            node={child}
            activePaneId={activePaneId}
            onFocusPane={onFocusPane}
            onPaneInput={onPaneInput}
          />
        </div>
      ))}
    </div>
  );
}

type SyncBarProps = {
  syncEnabled: boolean;
  onToggleSync: () => void;
  onBindRepo: () => void;
  repoStatus: RepoStatusDto | null;
  repoError: string | null;
  repoLoading: boolean;
  onCreateAgent: () => void;
  onQuit: () => void;
  onClearCachesAndQuit: () => void;
};

function SyncBar({
  syncEnabled,
  onToggleSync,
  onBindRepo,
  repoStatus,
  repoError,
  repoLoading,
  onCreateAgent,
  onQuit,
  onClearCachesAndQuit,
}: SyncBarProps) {
  const stagedCount = repoStatus
    ? repoStatus.modified_files.filter((file) => file.staged).length
    : 0;
  const unstagedCount = repoStatus
    ? repoStatus.modified_files.filter((file) => file.unstaged).length
    : 0;

  return (
    <div className="broadcast-bar">
      <div className="broadcast-meta">
        <button
          className={syncEnabled ? "chip active" : "chip"}
          onClick={onToggleSync}
          title="Mirror keystrokes from the active pane to all other panes"
        >
          Sync typing to all panes
        </button>
        <button className="chip" onClick={onBindRepo} disabled={repoLoading}>
          {repoLoading ? "Binding..." : "Bind git repo"}
        </button>
        <button
          className="chip"
          onClick={onCreateAgent}
          disabled={!repoStatus || repoLoading}
          title="Create a new agent worktree and run its start command"
        >
          Create new agent
        </button>
        <button
          className="chip chip-clear"
          onClick={onClearCachesAndQuit}
          title="Clear cached repo/agent data and quit"
        >
          Clear caches &amp; quit
        </button>
        <button className="chip chip-quit" onClick={onQuit} title="Quit app">
          Quit
        </button>
      </div>
      <div className="repo-status-row">
        {repoLoading ? (
          <div className="repo-status muted">Checking repository...</div>
        ) : repoError ? (
          <div className="repo-status repo-error">{repoError}</div>
        ) : repoStatus ? (
          <div className="repo-summary">
            <div className="repo-path">{repoStatus.root_path}</div>
            <div className="repo-counts">
              Staged {stagedCount} · Unstaged {unstagedCount}
            </div>
          </div>
        ) : (
          <div className="repo-status muted">No git repo bound.</div>
        )}
      </div>
    </div>
  );
}

function AgentOverview({
  agents,
  diffStats,
  openMenuId,
  onToggleMenu,
  onRemoveAgent,
  removingAgentId,
}: {
  agents: Agent[];
  diffStats: Record<string, AgentDiffStat | undefined>;
  openMenuId: string | null;
  onToggleMenu: (agentId: string) => void;
  onRemoveAgent: (agent: Agent) => void;
  removingAgentId: string | null;
}) {
  if (!agents.length) return null;

  const formatDiffStat = (stat?: AgentDiffStat) => {
    if (!stat) return "\u2014";
    const fileLabel = stat.files_changed === 1 ? "file" : "files";
    return `${stat.files_changed} ${fileLabel} +${stat.insertions} -${stat.deletions}`;
  };

  return (
    <div className="agent-overview">
      <div className="agent-head">
        <div className="agent-pills">
          <span className="pill">Agents {agents.length}</span>
        </div>
        <div className="agent-meta muted">Worktrees {agents.length}</div>
      </div>
      <div className="agent-grid">
        {agents.map((agent) => {
          const diff = diffStats[agent.id];
          return (
            <div className="agent-card" key={agent.id}>
              <div className="agent-card-top">
                <div className="agent-card-heading">
                  <div className="agent-name">{agent.name}</div>
                  <div className={diff ? "agent-diff" : "agent-diff agent-diff-pending"}>
                    {formatDiffStat(diff)}
                  </div>
                </div>
                <button
                  className="agent-menu-button"
                  aria-label="Agent actions"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleMenu(agent.id);
                  }}
                >
                  ...
                </button>
                {openMenuId === agent.id ? (
                  <div
                    className="agent-menu"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="agent-menu-item danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveAgent(agent);
                      }}
                      disabled={removingAgentId === agent.id}
                    >
                      {removingAgentId === agent.id ? "Removing..." : "Remove agent"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentNameInput, setAgentNameInput] = useState("");
  const [agentCommandInput, setAgentCommandInput] = useState("");
  const [agentError, setAgentError] = useState<string | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentMenuOpenId, setAgentMenuOpenId] = useState<string | null>(null);
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);
  const hasRestoredRepo = useRef(false);
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

  const buildLayoutFromPanes = useCallback((panes: PaneNode[]): LayoutNode | null => {
    if (!panes.length) return null;
    return panes.reduce<LayoutNode | null>((acc, pane) => {
      if (!acc) return pane;
      return {
        type: "split",
        id: createId(),
        orientation: "vertical",
        children: [acc, pane],
      };
    }, null);
  }, []);

  const launchAgentPanes = useCallback(
    async (agentList: Agent[]) => {
      await killLayoutSessions(layout);
      if (!agentList.length) {
        setLayout(null);
        setActivePaneId(null);
        setSyncTyping(false);
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
    [buildLayoutFromPanes, killLayoutSessions, layout, runStartCommand]
  );

  const refreshAgentDiffStats = useCallback(
    async (repoRoot: string) => {
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
    },
    []
  );

  const loadAgentsForRepo = useCallback(
    async (repoRoot: string) => {
      try {
        const loaded = await invoke<Agent[]>("list_agents", { repoRoot });
        setAgents(loaded);
        setAgentMenuOpenId(null);
        setRemovingAgentId(null);
        await launchAgentPanes(loaded);
        if (loaded.length) {
          await refreshAgentDiffStats(repoRoot);
        } else {
          setAgentDiffStats({});
        }
      } catch (error) {
        console.error("Failed to load agents", error);
        setAgents([]);
        setAgentMenuOpenId(null);
        setRemovingAgentId(null);
        setAgentDiffStats({});
        await killLayoutSessions(layout);
        setLayout(null);
        setActivePaneId(null);
      }
    },
    [killLayoutSessions, launchAgentPanes, layout, refreshAgentDiffStats]
  );

  const bindRepoPath = useCallback(
    async (pickedPath: string, silent?: boolean) => {
      if (!pickedPath) return;
      setRepoError(null);
      setRepoLoading(true);
      setAgentDiffStats({});
      try {
        const repoRoot = await invoke<string | null>("git_detect_repo", { cwd: pickedPath });
        if (!repoRoot) {
          setRepoStatus(null);
          setAgents([]);
          setAgentMenuOpenId(null);
          setRemovingAgentId(null);
          setAgentDiffStats({});
          if (!silent) {
            setRepoError("Selected folder is not inside a git repository.");
          }
          await killLayoutSessions(layout);
          setLayout(null);
          setActivePaneId(null);
          return;
        }

        const status = await invoke<RepoStatusDto>("git_status", { cwd: repoRoot });
        setRepoStatus(status);
        setRepoError(null);
        localStorage.setItem(LAST_REPO_KEY, repoRoot);
        await loadAgentsForRepo(repoRoot);
      } catch (error) {
        if (!silent) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === "string"
                ? error
                : "Failed to bind git repo.";
          setRepoError(message);
          setRepoStatus(null);
          setAgents([]);
          setAgentMenuOpenId(null);
          setRemovingAgentId(null);
          setAgentDiffStats({});
          await killLayoutSessions(layout);
          setLayout(null);
          setActivePaneId(null);
        }
      } finally {
        setRepoLoading(false);
      }
    },
    [killLayoutSessions, layout, loadAgentsForRepo]
  );

  const handleBindRepo = useCallback(async () => {
    setRepoError(null);
    let pickedPath: string | null = null;
    try {
      const selection = await open({
        directory: true,
        multiple: false,
      });
      pickedPath = Array.isArray(selection) ? selection[0] : selection;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to open folder picker.";
      setRepoError(message);
      return;
    }

    if (!pickedPath) return;

    await bindRepoPath(pickedPath);
  }, [bindRepoPath]);

  const appendPaneForAgent = useCallback(
    (pane: PaneNode) => {
      setLayout((prev) => {
        const panes = collectPanes(prev);
        return buildLayoutFromPanes([...panes, pane]);
      });
      setActivePaneId(pane.id);
      setSyncTyping(false);
    },
    [buildLayoutFromPanes]
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
      const agent = await invoke<Agent>("create_agent", {
        repoRoot: repoStatus.root_path,
        name,
        startCommand,
        baseBranch: repoStatus.branch,
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
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to create agent.";
      setAgentError(message);
    } finally {
      setCreatingAgent(false);
    }
  }, [
    agentCommandInput,
    agentNameInput,
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
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Failed to remove agent.";
        setRepoError(message);
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
    hasRestoredRepo.current = true;
    if (storedRepo) {
      void bindRepoPath(storedRepo, true);
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
