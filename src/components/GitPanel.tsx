import { Icon } from "./Icons";
import { useGitTabs } from "../hooks/git/useGitTabs";
import { GitTabBar } from "./git/GitTabBar";
import { GitBranches } from "./git/GitBranches";
import { GitCommits } from "./git/GitCommits";
import { GitRepos } from "./git/GitRepos";
import { GitStaging } from "./git/GitStaging";
import { GitStashes } from "./git/GitStashes";
import { GitWorktrees } from "./git/GitWorktrees";
import { GitRemotes } from "./git/GitRemotes";
import {
  ChangedFile,
  CommitItem,
  GitTab,
  RemoteItem,
  RepoBranchGroup,
  RepoGroup,
  RepoHeader,
  StashItem,
  WorktreeItem,
} from "../types/git-ui";

type GitPanelProps = {
  initialTabs?: GitTab[];
  repos?: RepoHeader[];
  enabledRepoIds?: string[];
  branchGroups?: RepoBranchGroup[];
  commitGroups?: RepoGroup<CommitItem>[];
  worktreeGroups?: RepoGroup<WorktreeItem>[];
  changedFileGroups?: RepoGroup<ChangedFile>[];
  remoteGroups?: RepoGroup<RemoteItem>[];
  stashGroups?: RepoGroup<StashItem>[];
  width?: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEnableRepos?: (repoIds: string[]) => void;
  onCommit?: (repoId: string, message: string) => void;
  onPull?: (repoId: string) => void;
  onPush?: (repoId: string, force: boolean) => void;
  onStageAll?: (repoId: string) => void;
  onUnstageAll?: (repoId: string) => void;
  onStageFile?: (repoId: string, path: string) => void;
  onUnstageFile?: (repoId: string, path: string) => void;
  onRollbackFile?: (repoId: string, path: string) => void;
  onLoadMoreCommits?: (repoId: string) => void;
  onLoadMoreLocalBranches?: (repoId: string) => void;
  onLoadMoreRemoteBranches?: (repoId: string) => void;
  canLoadMoreCommits?: (repoId: string) => boolean;
  canLoadMoreLocalBranches?: (repoId: string) => boolean;
  canLoadMoreRemoteBranches?: (repoId: string) => boolean;
  isLoadingMoreCommits?: (repoId: string) => boolean;
  onCreateBranch?: (repoId: string, name: string, sourceBranch?: string) => void;
  onOpenFolder?: () => void;
  onSwitchBranch?: (repoId: string, branchName: string) => void;
  onDeleteBranch?: (repoId: string, branchName: string) => void;
  onReset?: (repoId: string, commitId: string, mode: "soft" | "mixed" | "hard") => void;
  onRevert?: (repoId: string, commitId: string) => void;
  onSquashCommits?: (repoId: string, commitIds: string[]) => void;
  onCreateWorktree?: (repoId: string, branchName: string, path: string) => void;
  onDeleteWorktree?: (repoId: string, branchName: string) => void;
  onRemoveRepo?: (repoId: string) => void;
  onActivateRepo?: (repoId: string) => void;
};

const defaultTabs: GitTab[] = [
  { id: "repos", label: "Repos", icon: "folder" },
  { id: "branches", label: "Branches", icon: "branch" },
  { id: "commits", label: "Commits", icon: "commit" },
  { id: "commit", label: "Changes", icon: "fileEdit" },
  { id: "stashes", label: "Stashes", icon: "archive" },
  { id: "worktrees", label: "Worktrees", icon: "folder" },
  { id: "remotes", label: "Remotes", icon: "cloud" },
];

export function GitPanel({
  initialTabs,
  repos = [],
  enabledRepoIds,
  branchGroups = [],
  commitGroups = [],
  worktreeGroups = [],
  changedFileGroups = [],
  remoteGroups = [],
  stashGroups = [],
  width,
  loading = false,
  error,
  onRefresh,
  onEnableRepos,
  onCommit,
  onPull,
  onPush,
  onStageAll,
  onUnstageAll,
  onStageFile,
  onUnstageFile,
  onRollbackFile,
  onLoadMoreCommits,
  onLoadMoreLocalBranches,
  onLoadMoreRemoteBranches,
  canLoadMoreCommits,
  canLoadMoreLocalBranches,
  canLoadMoreRemoteBranches,
  isLoadingMoreCommits,
  onCreateBranch,
  onOpenFolder,
  onSwitchBranch,
  onDeleteBranch,
  onReset,
  onRevert,
  onSquashCommits,
  onCreateWorktree,
  onDeleteWorktree,
  onRemoveRepo,
  onActivateRepo,
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

  const handleCommit = (repoId: string, message: string) => {
    onCommit?.(repoId, message);
  };

  const handleStageAll = (repoId: string) => {
    onStageAll?.(repoId);
  };

  const handleUnstageAll = (repoId: string) => {
    onUnstageAll?.(repoId);
  };

  const handleStageFile = (repoId: string, path: string) => {
    onStageFile?.(repoId, path);
  };

  const handleUnstageFile = (repoId: string, path: string) => {
    onUnstageFile?.(repoId, path);
  };

  const handleRollbackFile = (repoId: string, path: string) => {
    onRollbackFile?.(repoId, path);
  };

  return (
    <aside className="git-panel" style={{ width }}>
      <div className="panel-header">
        <div className="panel-title">
          <Icon name="branch" size={16} />
          <span>Git Manager</span>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            className="icon-button icon-button--small"
            title="Add Repository"
            onClick={onOpenFolder}
          >
            <Icon name="plus" size={14} />
          </button>
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
        {activeTab === "repos" ? (
          <GitRepos
            repos={repos}
            enabledRepoIds={enabledRepoIds}
            onEnableRepos={onEnableRepos}
            // Active repo concept removed, pass null or maybe allow selection for highlighting?
            // User requested to remove active repo concept. So we pass nothing or maybe pass selection state if managed here.
            // For now pass null as activeRepoId.
            activeRepoId={null} 
            onActivateRepo={onActivateRepo}
            onRemoveRepo={onRemoveRepo}
          />
        ) : null}

        {error ? (
          <div className="git-empty">
            <Icon name="alert" size={22} />
            <p>{error}</p>
            <button type="button" className="git-primary-button" onClick={onRefresh}>
              Retry
            </button>
          </div>
        ) : null}

        {!repos.length ? (
           <div className="git-empty">
            <Icon name="folder" size={22} />
            <p>No repositories bound.</p>
            <button type="button" className="git-primary-button" onClick={onOpenFolder}>
              Open Folder
            </button>
          </div>
        ) : (
          <>
            {activeTab === "branches" ? (
              <GitBranches
                branchGroups={branchGroups}
                onLoadMoreLocal={onLoadMoreLocalBranches}
                onLoadMoreRemote={onLoadMoreRemoteBranches}
                canLoadMoreLocal={canLoadMoreLocalBranches}
                canLoadMoreRemote={canLoadMoreRemoteBranches}
                onCreateBranch={onCreateBranch}
                onSwitchBranch={onSwitchBranch}
                onDeleteBranch={onDeleteBranch}
                onPull={onPull}
                onPush={onPush}
              />
            ) : null}

            {activeTab === "commits" ? (
              <GitCommits
                commitGroups={commitGroups}
                onLoadMore={onLoadMoreCommits}
                canLoadMore={canLoadMoreCommits}
                isLoadingMore={isLoadingMoreCommits}
                onReset={onReset}
                onRevert={onRevert}
                onSquashCommits={onSquashCommits}
              />
            ) : null}

            {activeTab === "commit" ? (
              <GitStaging
                groups={changedFileGroups}
                onStageAll={handleStageAll}
                onUnstageAll={handleUnstageAll}
                onStageFile={handleStageFile}
                onUnstageFile={handleUnstageFile}
                onRollbackFile={handleRollbackFile}
                onCommit={handleCommit}
              />
            ) : null}

            {activeTab === "stashes" ? <GitStashes stashGroups={stashGroups} /> : null}

            {activeTab === "worktrees" ? (
              <GitWorktrees
                worktreeGroups={worktreeGroups}
                onCreateWorktree={onCreateWorktree}
                onDeleteWorktree={onDeleteWorktree}
              />
            ) : null}

            {activeTab === "remotes" ? <GitRemotes remoteGroups={remoteGroups} /> : null}
          </>
        )}
      </div>
    </aside>
  );
}
