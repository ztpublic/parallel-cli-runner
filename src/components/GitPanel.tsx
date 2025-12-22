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
  initialChangedFiles,
  initialCommits,
  initialLocalBranches,
  initialRemoteBranches,
  initialRemotes,
  initialTabs,
  initialWorktrees,
} from "../mocks/git-ui";

export function GitPanel() {
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
  } = useGitTabs(initialTabs);

  const {
    commitMessage,
    setCommitMessage,
    stagedFiles,
    unstagedFiles,
    toggleFileStage,
    stageAllFiles,
    unstageAllFiles,
    generateCommitMessage,
  } = useGitStaging(initialChangedFiles);

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
          <GitBranches
            localBranches={initialLocalBranches}
            remoteBranches={initialRemoteBranches}
          />
        ) : null}

        {activeTab === "commits" ? <GitCommits commits={initialCommits} /> : null}

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

        {activeTab === "worktrees" ? <GitWorktrees worktrees={initialWorktrees} /> : null}

        {activeTab === "remotes" ? <GitRemotes remotes={initialRemotes} /> : null}
      </div>
    </aside>
  );
}