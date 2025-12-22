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
  BranchItem,
  ChangedFile,
  CommitItem,
  GitTab,
  RemoteItem,
  WorktreeItem,
} from "../types/git-ui";

type GitPanelProps = {
  initialTabs?: GitTab[];
  localBranches?: BranchItem[];
  remoteBranches?: BranchItem[];
  commits?: CommitItem[];
  worktrees?: WorktreeItem[];
  remotes?: RemoteItem[];
  changedFiles?: ChangedFile[];
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
  localBranches = [],
  remoteBranches = [],
  commits = [],
  worktrees = [],
  remotes = [],
  changedFiles = [],
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
  } = useGitTabs(initialTabs ?? defaultTabs);

  const {
    commitMessage,
    setCommitMessage,
    stagedFiles,
    unstagedFiles,
    toggleFileStage,
    stageAllFiles,
    unstageAllFiles,
    generateCommitMessage,
  } = useGitStaging(changedFiles);

  return (
    <aside className="git-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Icon name="branch" size={16} />
          <span>Git Manager</span>
        </div>
        <button type="button" className="icon-button icon-button--small" title="Refresh">
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
      />

      <div className="git-panel-content">
        {activeTab === "branches" ? (
          <GitBranches localBranches={localBranches} remoteBranches={remoteBranches} />
        ) : null}

        {activeTab === "commits" ? <GitCommits commits={commits} /> : null}

        {activeTab === "commit" ? (
          <GitStaging
            stagedFiles={stagedFiles}
            unstagedFiles={unstagedFiles}
            commitMessage={commitMessage}
            onCommitMessageChange={setCommitMessage}
            onGenerateCommitMessage={generateCommitMessage}
            onStageAll={stageAllFiles}
            onUnstageAll={unstageAllFiles}
            onToggleFileStage={toggleFileStage}
          />
        ) : null}

        {activeTab === "worktrees" ? <GitWorktrees worktrees={worktrees} /> : null}

        {activeTab === "remotes" ? <GitRemotes remotes={remotes} /> : null}
      </div>
    </aside>
  );
}
