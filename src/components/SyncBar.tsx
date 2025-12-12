import { RepoStatusDto } from "../types/git";

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

export function SyncBar({
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

