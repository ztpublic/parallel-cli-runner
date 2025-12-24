import { Icon } from "./Icons";
import { useGitStaging } from "../hooks/git/useGitStaging";
import { useGitTabs } from "../hooks/git/useGitTabs";
import { GitTabBar } from "./git/GitTabBar";
import { GitBranches } from "./git/GitBranches";
import { GitCommits } from "./git/GitCommits";
import { GitStaging } from "./git/GitStaging";
import { GitWorktrees } from "./git/GitWorktrees";
import { GitRemotes } from "./git/GitRemotes";
import {
  ChangedFile,
  CommitItem,
  GitTab,
  RemoteItem,
  RepoBranchGroup,
  RepoGroup,
  WorktreeItem,
} from "../types/git-ui";

type GitPanelProps = {
  initialTabs?: GitTab[];
  branchGroups?: RepoBranchGroup[];
  commitGroups?: RepoGroup<CommitItem>[];
  worktreeGroups?: RepoGroup<WorktreeItem>[];
  remotes?: RemoteItem[];
  changedFiles?: ChangedFile[];
  width?: number;
  repoRoot?: string | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onCommit?: (message: string) => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
  onLoadMoreCommits?: (repoId: string) => void;
  onLoadMoreLocalBranches?: (repoId: string) => void;
  onLoadMoreRemoteBranches?: (repoId: string) => void;
  canLoadMoreCommits?: (repoId: string) => boolean;
  canLoadMoreLocalBranches?: (repoId: string) => boolean;
  canLoadMoreRemoteBranches?: (repoId: string) => boolean;
  isLoadingMoreCommits?: (repoId: string) => boolean;
};

const defaultTabs: GitTab[] = [
  { id: "branches", label: "Branches", icon: "branch" },
  { id: "commits", label: "Commits", icon: "commit" },
  { id: "commit", label: "Commit", icon: "commit" },
  { id: "worktrees", label: "Worktrees", icon: "folder" },
  { id: "remotes", label: "Remotes", icon: "cloud" },
];

export function GitPanel({
  initialTabs,
  branchGroups = [],
  commitGroups = [],
  worktreeGroups = [],
  remotes = [],
  changedFiles = [],
  width,
  repoRoot,
  loading = false,
  error,
  onRefresh,
  onCommit,
  onStageAll,
  onUnstageAll,
  onStageFile,
  onUnstageFile,
  onLoadMoreCommits,
  onLoadMoreLocalBranches,
  onLoadMoreRemoteBranches,
  canLoadMoreCommits,
  canLoadMoreLocalBranches,
  canLoadMoreRemoteBranches,
  isLoadingMoreCommits,
}: GitPanelProps) {
  const {
    tabs,
    activeTab,
    setActiveTab,
    draggedTabId,
    dragOverTabId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handlePointerDown,
  } = useGitTabs(initialTabs ?? defaultTabs);

  const {
    commitMessage,
    setCommitMessage,
    stagedFiles,
    unstagedFiles,
    generateCommitMessage,
  } = useGitStaging(changedFiles);

  const canInteract = Boolean(repoRoot) && !loading;

  const handleCommit = () => {
    if (!canInteract || !onCommit) return;
    onCommit(commitMessage);
  };

  const handleStageAll = () => {
    if (!canInteract || !onStageAll) return;
    onStageAll();
  };

  const handleUnstageAll = () => {
    if (!canInteract || !onUnstageAll) return;
    onUnstageAll();
  };

  const handleStageFile = (path: string) => {
    if (!canInteract || !onStageFile) return;
    onStageFile(path);
  };

  const handleUnstageFile = (path: string) => {
    if (!canInteract || !onUnstageFile) return;
    onUnstageFile(path);
  };

  return (
    <aside className="git-panel" style={{ width }}>
      <div className="panel-header">
        <div className="panel-title">
          <Icon name="branch" size={16} />
          <span>Git Manager</span>
        </div>
        <button
          type="button"
          className="icon-button icon-button--small"
          title="Refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>

      <GitTabBar
        tabs={tabs}
        activeTab={activeTab}
        draggedTabId={draggedTabId}
        dragOverTabId={dragOverTabId}
        onTabClick={setActiveTab}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onPointerDown={handlePointerDown}
      />

      <div className="git-panel-content">
        {!repoRoot ? (
          <div className="git-empty">
            <Icon name="folder" size={22} />
            <p>No git repository detected.</p>
            <button type="button" className="git-primary-button" onClick={onRefresh}>
              Try Again
            </button>
          </div>
        ) : null}

        {repoRoot && error ? (
          <div className="git-empty">
            <Icon name="alert" size={22} />
            <p>{error}</p>
            <button type="button" className="git-primary-button" onClick={onRefresh}>
              Retry
            </button>
          </div>
        ) : null}

        {repoRoot && !error ? (
          <>
            {activeTab === "branches" ? (
              <GitBranches
                branchGroups={branchGroups}
                onLoadMoreLocal={onLoadMoreLocalBranches}
                onLoadMoreRemote={onLoadMoreRemoteBranches}
                canLoadMoreLocal={canLoadMoreLocalBranches}
                canLoadMoreRemote={canLoadMoreRemoteBranches}
              />
            ) : null}

            {activeTab === "commits" ? (
              <GitCommits
                commitGroups={commitGroups}
                onLoadMore={onLoadMoreCommits}
                canLoadMore={canLoadMoreCommits}
                isLoadingMore={isLoadingMoreCommits}
              />
            ) : null}

            {activeTab === "commit" ? (
              <GitStaging
                stagedFiles={stagedFiles}
                unstagedFiles={unstagedFiles}
                commitMessage={commitMessage}
                onCommitMessageChange={setCommitMessage}
                onGenerateCommitMessage={generateCommitMessage}
                onStageAll={handleStageAll}
                onUnstageAll={handleUnstageAll}
                onStageFile={handleStageFile}
                onUnstageFile={handleUnstageFile}
                onCommit={handleCommit}
              />
            ) : null}

            {activeTab === "worktrees" ? (
              <GitWorktrees worktreeGroups={worktreeGroups} />
            ) : null}

            {activeTab === "remotes" ? <GitRemotes remotes={remotes} /> : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}
