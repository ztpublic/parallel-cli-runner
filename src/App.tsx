import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./App.css";
import { TaskSession } from "./types/taskSession";

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
  branchName?: string;
  worktreePath?: string;
  taskSessionId?: string;
};

const createId = () => crypto.randomUUID();

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

function splitLayout(
  node: LayoutNode,
  targetPaneId: string,
  newPane: PaneNode,
  orientation: Orientation
): LayoutNode {
  if (node.type === "pane" && node.id === targetPaneId) {
    return {
      type: "split",
      id: createId(),
      orientation,
      children: [node, newPane],
    };
  }

  if (node.type === "split") {
    const [left, right] = node.children;
    return {
      ...node,
      children: [
        splitLayout(left, targetPaneId, newPane, orientation),
        splitLayout(right, targetPaneId, newPane, orientation),
      ],
    };
  }

  return node;
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
        <div className="pane-label-primary">{pane.meta?.agentId ?? "Pane"}</div>
        {pane.meta?.branchName ? (
          <div className="pane-label-sub">{pane.meta.branchName}</div>
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
  paneCount: number;
  onSplit: () => void;
  onBindRepo: () => void;
  repoStatus: RepoStatusDto | null;
  repoError: string | null;
  repoLoading: boolean;
  onStartSession: () => void;
  taskSession: TaskSession | null;
};

function SyncBar({
  syncEnabled,
  onToggleSync,
  paneCount,
  onSplit,
  onBindRepo,
  repoStatus,
  repoError,
  repoLoading,
  onStartSession,
  taskSession,
}: SyncBarProps) {
  const stagedCount = repoStatus
    ? repoStatus.modified_files.filter((file) => file.staged).length
    : 0;
  const unstagedCount = repoStatus
    ? repoStatus.modified_files.filter((file) => file.unstaged).length
    : 0;
  const aheadBehind =
    repoStatus && (repoStatus.ahead !== 0 || repoStatus.behind !== 0)
      ? `↑${repoStatus.ahead} ↓${repoStatus.behind}`
      : null;

  return (
    <div className="broadcast-bar">
      <div className="broadcast-meta">
        <button className="chip" onClick={onSplit} title="Split vertically (Ctrl+Shift+D)">
          Split pane
        </button>
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
        <button className="chip" onClick={onStartSession} disabled={!repoStatus}>
          Start parallel task
        </button>
        <div className="pane-count">Panes: {paneCount}</div>
      </div>
      <div className="repo-status-row">
        {repoLoading ? (
          <div className="repo-status muted">Checking repository...</div>
        ) : repoError ? (
          <div className="repo-status repo-error">{repoError}</div>
        ) : repoStatus ? (
          <div className="repo-status">
            <div className="repo-path">{repoStatus.root_path}</div>
            <div className="repo-branch">
              <span className="pill">Branch {repoStatus.branch}</span>
              {aheadBehind ? <span className="pill subtle">{aheadBehind}</span> : null}
              {repoStatus.conflicted_files > 0 ? (
                <span className="pill warning">{repoStatus.conflicted_files} conflicted</span>
              ) : null}
            </div>
            {repoStatus.latest_commit ? (
              <div className="repo-commit">
                Latest:{" "}
                <span className="repo-commit-summary">{repoStatus.latest_commit.summary}</span>
                <span className="repo-commit-meta">
                  {repoStatus.latest_commit.author} · {repoStatus.latest_commit.relative_time}
                </span>
              </div>
            ) : (
              <div className="repo-commit muted">No commits yet.</div>
            )}
            <div className="repo-counts">
              Staged {stagedCount} · Unstaged {unstagedCount} · Untracked{" "}
              {repoStatus.has_untracked ? "yes" : "no"}
            </div>
            {taskSession ? (
              <div className="repo-commit">
                <span className="pill">Session {taskSession.id}</span>
                <span className="pill subtle">Base {taskSession.base_branch}</span>
                <span className="pill subtle">State {taskSession.state}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="repo-status muted">No git repo bound.</div>
        )}
      </div>
    </div>
  );
}

function SessionOverview({ session }: { session: TaskSession | null }) {
  if (!session) return null;

  return (
    <div className="session-overview">
      <div className="session-head">
        <div className="session-pills">
          <span className="pill">Session {session.id}</span>
          <span className="pill subtle">Base {session.base_branch}</span>
          <span className="pill subtle">Commit {session.base_commit.slice(0, 7)}</span>
          <span className={`pill ${session.state === "active" ? "success" : "subtle"}`}>
            State {session.state}
          </span>
        </div>
        <div className="session-meta muted">Agents {session.agents.length}</div>
      </div>
      <div className="agent-grid">
        {session.agents.map((agent) => (
          <div className="agent-card" key={agent.agent_id}>
            <div className="agent-card-top">
              <div className="agent-name">{agent.agent_id}</div>
              <span className={`badge status-${agent.status}`}>{agent.status}</span>
            </div>
            <div className="agent-branch">{agent.branch_name}</div>
            <div className="agent-path muted">{agent.worktree_path}</div>
          </div>
        ))}
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
  const [taskSession, setTaskSession] = useState<TaskSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionBranchInput, setSessionBranchInput] = useState("");
  const [sessionAgentsInput, setSessionAgentsInput] = useState("agent-1\nagent-2");
  const [creatingSession, setCreatingSession] = useState(false);

  const killLayoutSessions = useCallback(async (node: LayoutNode | null) => {
    const panes = collectPanes(node);
    await Promise.all(
      panes.map((pane) =>
        invoke("kill_session", { id: pane.sessionId }).catch(() => undefined)
      )
    );
  }, [taskSession]);

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

  const launchAgentsForSession = useCallback(
    async (session: TaskSession) => {
      await killLayoutSessions(layout);
      const panes: PaneNode[] = [];
      for (const agent of session.agents) {
        const pane = await createPaneNode({
          cwd: agent.worktree_path,
          meta: {
            agentId: agent.agent_id,
            branchName: agent.branch_name,
            worktreePath: agent.worktree_path,
            taskSessionId: session.id,
          },
        });
        panes.push(pane);
      }
      const nextLayout = buildLayoutFromPanes(panes);
      setLayout(nextLayout);
      setActivePaneId(panes[0]?.id ?? null);
      setSyncTyping(false);
    },
    [buildLayoutFromPanes, killLayoutSessions, layout]
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

    setRepoLoading(true);
    try {
      const repoRoot = await invoke<string | null>("git_detect_repo", { cwd: pickedPath });
      if (!repoRoot) {
        setRepoStatus(null);
        setRepoError("Selected folder is not inside a git repository.");
        return;
      }

      if (taskSession && taskSession.repo_id !== repoRoot) {
        setTaskSession(null);
      }

      const status = await invoke<RepoStatusDto>("git_status", { cwd: repoRoot });
      setRepoStatus(status);
      setRepoError(null);
      setSessionBranchInput(status.branch);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to bind git repo.";
      setRepoError(message);
      setRepoStatus(null);
    } finally {
      setRepoLoading(false);
    }
  }, []);

  const openSessionDialog = useCallback(() => {
    if (!repoStatus) {
      setRepoError("Bind a git repo before starting a parallel task.");
      return;
    }
    setSessionBranchInput(repoStatus.branch);
    setSessionDialogOpen(true);
    setSessionError(null);
  }, [repoStatus]);

  const handleCreateSession = useCallback(async () => {
    if (!repoStatus) {
      setSessionError("Bind a git repo before starting a session.");
      return;
    }

    const agentNames = sessionAgentsInput
      .split(/\r?\n|,/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (!agentNames.length) {
      setSessionError("Add at least one agent name.");
      return;
    }

    setCreatingSession(true);
    setSessionError(null);
    try {
      const session = await invoke<TaskSession>("create_task_session", {
        repoRoot: repoStatus.root_path,
        baseBranch: sessionBranchInput || repoStatus.branch,
        agents: agentNames.map((agent_id) => ({ agent_id, panel_id: null })),
      });
      setTaskSession(session);
      await launchAgentsForSession(session);
      setSessionDialogOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to start task session.";
      setSessionError(message);
    } finally {
      setCreatingSession(false);
    }
  }, [launchAgentsForSession, repoStatus, sessionAgentsInput, sessionBranchInput]);

  const splitActivePane = useCallback(
    async (orientation: Orientation) => {
      const newPane = await createPaneNode();

      setLayout((prev) => {
        if (!prev) {
          setActivePaneId(newPane.id);
          setSyncTyping(false);
          return newPane;
        }

        const targetPaneId = activePaneId ?? getFirstPane(prev)?.id;
        if (!targetPaneId) {
          setActivePaneId(newPane.id);
          setSyncTyping(false);
          return newPane;
        }

        setActivePaneId(newPane.id);
        return splitLayout(prev, targetPaneId, newPane, orientation);
      });
    },
    [activePaneId]
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
      if (event.code === "KeyD") {
        event.preventDefault();
        void splitActivePane("vertical");
      } else if (event.code === "KeyW") {
        event.preventDefault();
        void closeActivePane();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [splitActivePane, closeActivePane]);

  const paneCount = useMemo(() => countPanes(layout), [layout]);

  return (
    <main className="app-shell">
      <header className="app-header" />
      <SyncBar
        syncEnabled={syncTyping}
        onToggleSync={() => setSyncTyping((prev) => !prev)}
        paneCount={paneCount}
        onSplit={() => void splitActivePane("vertical")}
        onBindRepo={() => void handleBindRepo()}
        repoStatus={repoStatus}
        repoError={repoError}
        repoLoading={repoLoading}
        onStartSession={openSessionDialog}
        taskSession={taskSession}
      />
      <SessionOverview session={taskSession} />
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
          <div className="loading">
            No terminals yet. Click "Split pane" to start the first one.
          </div>
        )}
      </section>
      {sessionDialogOpen ? (
        <div
          className="session-dialog-backdrop"
          onClick={() => {
            if (!creatingSession) setSessionDialogOpen(false);
          }}
        >
          <div
            className="session-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="session-dialog-header">
              <h3>Start parallel task</h3>
              <p className="muted">
                Creates one worktree per agent from {repoStatus?.root_path ?? "your repo"}.
              </p>
            </div>
            <label className="field">
              <span>Base branch</span>
              <input
                value={sessionBranchInput}
                onChange={(e) => setSessionBranchInput(e.target.value)}
                placeholder={repoStatus?.branch ?? "main"}
              />
            </label>
            <label className="field">
              <span>Agents (one per line)</span>
              <textarea
                value={sessionAgentsInput}
                onChange={(e) => setSessionAgentsInput(e.target.value)}
                rows={4}
              />
            </label>
            {sessionError ? <div className="session-error">{sessionError}</div> : null}
            <div className="dialog-actions">
              <button
                className="chip"
                onClick={() => setSessionDialogOpen(false)}
                disabled={creatingSession}
              >
                Cancel
              </button>
              <button
                className="chip primary"
                onClick={() => void handleCreateSession()}
                disabled={creatingSession}
              >
                {creatingSession ? "Creating..." : "Create session"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
