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
import { GitSubmodules } from "./git/GitSubmodules";
import {
  ChangedFile,
  GitTab,
  RemoteItem,
  RepoBranchGroup,
  RepoGroup,
  RepoHeader,
  StashItem,
  SubmoduleItem,
  WorktreeCommits,
  WorktreeItem,
} from "../types/git-ui";

type GitPanelProps = {
  initialTabs?: GitTab[];
  repos?: RepoHeader[];
  enabledRepoIds?: string[];
  branchGroups?: RepoBranchGroup[];
  commitGroups?: RepoGroup<WorktreeCommits>[];
  worktreeGroups?: RepoGroup<WorktreeItem>[];
  changedFileGroups?: RepoGroup<ChangedFile>[];
  remoteGroups?: RepoGroup<RemoteItem>[];
  submoduleGroups?: RepoGroup<SubmoduleItem>[];
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
  onRollbackFiles?: (repoId: string, paths: string[]) => void;
  onLoadMoreCommits?: (repoId: string, worktreePath: string) => void;
  onLoadMoreLocalBranches?: (repoId: string) => void;
  onLoadMoreRemoteBranches?: (repoId: string) => void;
  canLoadMoreCommits?: (repoId: string, worktreePath: string) => boolean;
  canLoadMoreLocalBranches?: (repoId: string) => boolean;
  canLoadMoreRemoteBranches?: (repoId: string) => boolean;
  isLoadingMoreCommits?: (repoId: string, worktreePath: string) => boolean;
  onCreateBranch?: (repoId: string, name: string, sourceBranch?: string) => void;
  onOpenFolder?: () => void;
  onSwitchBranch?: (repoId: string, branchName: string) => void;
  onDeleteBranch?: (repoId: string, branchName: string) => void;
  onMergeBranch?: (repoId: string, targetBranch: string, sourceBranch: string) => void;
  onRebaseBranch?: (repoId: string, targetBranch: string, ontoBranch: string) => void;
  onReset?: (
    repoId: string,
    worktreePath: string,
    commitId: string,
    mode: "soft" | "mixed" | "hard"
  ) => void;
  onRevert?: (repoId: string, worktreePath: string, commitId: string) => void;
  onSquashCommits?: (repoId: string, worktreePath: string, commitIds: string[]) => void;
  onCreateWorktree?: (repoId: string, branchName: string, path: string) => void;
  onDeleteWorktree?: (repoId: string, branchName: string) => void;
  onApplyStash?: (repoId: string, stashIndex: number) => void;
  onDeleteStash?: (repoId: string, stashIndex: number) => void;
  onRemoveRepo?: (repoId: string) => void;
  onActivateRepo?: (repoId: string) => void;
  onOpenRepoTerminal?: (repo: RepoHeader) => void;
  onOpenRepoFolder?: (repo: RepoHeader) => void;
  onOpenWorktreeTerminal?: (repo: RepoHeader, worktree: WorktreeItem) => void;
  onOpenWorktreeFolder?: (repo: RepoHeader, worktree: WorktreeItem) => void;
};

const defaultTabs: GitTab[] = [
  { id: "repos", label: "Repos", icon: "folder" },
  { id: "branches", label: "Branches", icon: "branch" },
  { id: "commits", label: "Commits", icon: "commit" },
  { id: "commit", label: "Changes", icon: "fileEdit" },
  { id: "stashes", label: "Stashes", icon: "archive" },
  { id: "worktrees", label: "Worktrees", icon: "folder" },
  { id: "submodules", label: "Submodules", icon: "merge" },
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
  submoduleGroups = [],
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
  onRollbackFiles,
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
  onMergeBranch,
  onRebaseBranch,
  onReset,
  onRevert,
  onSquashCommits,
  onCreateWorktree,
  onDeleteWorktree,
  onApplyStash,
  onDeleteStash,
  onRemoveRepo,
  onActivateRepo,
  onOpenRepoTerminal,
  onOpenRepoFolder,
  onOpenWorktreeTerminal,
  onOpenWorktreeFolder,
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
  const hasRepos = repos.length > 0;

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

  const handleRollbackFiles = (repoId: string, paths: string[]) => {
    onRollbackFiles?.(repoId, paths);
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
        {hasRepos && activeTab === "repos" ? (
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
            onOpenTerminal={onOpenRepoTerminal}
            onOpenRepoFolder={onOpenRepoFolder}
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

        {!hasRepos ? (
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
                onMergeBranch={onMergeBranch}
                onRebaseBranch={onRebaseBranch}
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
                onRollbackFiles={handleRollbackFiles}
                onCommit={handleCommit}
              />
            ) : null}

            {activeTab === "stashes" ? (
              <GitStashes
                stashGroups={stashGroups}
                onApplyStash={onApplyStash}
                onDeleteStash={onDeleteStash}
              />
            ) : null}

            {activeTab === "worktrees" ? (
              <GitWorktrees
                worktreeGroups={worktreeGroups}
                onCreateWorktree={onCreateWorktree}
                onDeleteWorktree={onDeleteWorktree}
                onOpenTerminal={onOpenWorktreeTerminal}
                onOpenWorktreeFolder={onOpenWorktreeFolder}
                onMergeBranch={onMergeBranch}
                onRebaseBranch={onRebaseBranch}
              />
            ) : null}

            {activeTab === "submodules" ? (
              <GitSubmodules submoduleGroups={submoduleGroups} />
            ) : null}

            {activeTab === "remotes" ? <GitRemotes remoteGroups={remoteGroups} /> : null}
          </>
        )}
      </div>
    </aside>
  );
}
