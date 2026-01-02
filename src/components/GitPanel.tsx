import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icons";
import { ContextMenu } from "./ContextMenu";
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
  GitTabId,
  RemoteItem,
  RepoBranchGroup,
  RepoGroup,
  RepoHeader,
  StashItem,
  SubmoduleItem,
  WorktreeCommits,
  WorktreeItem,
} from "../types/git-ui";
import type { TreeNodeContextMenuItem } from "../types/tree";

type GitTabGroup = "top" | "bottom";

type GitPanelProps = {
  initialTabs?: GitTab[];
  initialSplit?: boolean;
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
  onCommit?: (repoId: string, message: string) => Promise<any> | void;
  onPull?: (repoId: string) => void;
  onPush?: (repoId: string, force: boolean) => void;
  onStageAll?: (repoId: string) => Promise<any> | void;
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
  initialSplit = false,
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
    tabGroups,
    topTabs,
    bottomTabs,
    activeTab,
    setActiveTab,
    activeTopTab,
    setActiveTopTab,
    activeBottomTab,
    setActiveBottomTab,
    draggedTabId,
    dragOverTabId,
    dragOverGroup,
    moveTabToGroup,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handlePointerDown,
  } = useGitTabs(initialTabs ?? defaultTabs);
  const [isSplit, setIsSplit] = useState(initialSplit);
  const [lastActiveGroup, setLastActiveGroup] = useState<GitTabGroup>("top");
  const [tabContextMenu, setTabContextMenu] = useState<{
    tabId: GitTabId;
    position: { x: number; y: number };
  } | null>(null);
  const hasRepos = repos.length > 0;
  const shouldRefresh = isSplit
    ? activeTopTab === "commit" || activeBottomTab === "commit"
    : activeTab === "commit";

  useEffect(() => {
    if (!shouldRefresh || !onRefresh || !hasRepos) return;
    const intervalId = window.setInterval(() => {
      onRefresh();
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [shouldRefresh, hasRepos, onRefresh]);

  const handleCommit = (repoId: string, message: string) => {
    return onCommit?.(repoId, message);
  };

  const handleStageAll = (repoId: string) => {
    return onStageAll?.(repoId);
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

  const handleToggleSplit = () => {
    if (isSplit) {
      const fallbackTab = lastActiveGroup === "bottom" ? activeBottomTab : activeTopTab;
      setActiveTab(fallbackTab);
      setIsSplit(false);
      return;
    }

    const activeGroup = tabGroups[activeTab] ?? "top";
    if (activeGroup === "bottom") {
      setActiveBottomTab(activeTab);
      setActiveTopTab(topTabs[0]?.id ?? activeTab);
      setLastActiveGroup("bottom");
    } else {
      setActiveTopTab(activeTab);
      setActiveBottomTab(bottomTabs[0]?.id ?? activeTab);
      setLastActiveGroup("top");
    }
    setIsSplit(true);
  };

  const handleSingleTabClick = (tabId: GitTabId) => {
    setActiveTab(tabId);
    setLastActiveGroup(tabGroups[tabId] ?? "top");
  };

  const handleTopTabClick = (tabId: GitTabId) => {
    setActiveTopTab(tabId);
    setLastActiveGroup("top");
  };

  const handleBottomTabClick = (tabId: GitTabId) => {
    setActiveBottomTab(tabId);
    setLastActiveGroup("bottom");
  };

  const tabContextItems = useMemo(() => {
    if (!tabContextMenu || !isSplit) return [];
    const tabGroup = tabGroups[tabContextMenu.tabId] ?? "top";
    const topCount = topTabs.length;
    const bottomCount = bottomTabs.length;

    const moveTopDisabled = tabGroup === "top" || bottomCount <= 1;
    const moveBottomDisabled = tabGroup === "bottom" || topCount <= 1;

    const items: TreeNodeContextMenuItem[] = [
      {
        id: "move-top",
        label: "Move to Top Panel",
        disabled: moveTopDisabled,
      },
      {
        id: "move-bottom",
        label: "Move to Bottom Panel",
        disabled: moveBottomDisabled,
      },
    ];

    return items;
  }, [bottomTabs.length, isSplit, tabContextMenu, tabGroups, topTabs.length]);

  const renderTabContent = (tabId: GitTabId) => (
    <>
      {hasRepos && tabId === "repos" ? (
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
          {tabId === "branches" ? (
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

          {tabId === "commits" ? (
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

          {tabId === "commit" ? (
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

          {tabId === "stashes" ? (
            <GitStashes
              stashGroups={stashGroups}
              onApplyStash={onApplyStash}
              onDeleteStash={onDeleteStash}
            />
          ) : null}

          {tabId === "worktrees" ? (
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

          {tabId === "submodules" ? (
            <GitSubmodules submoduleGroups={submoduleGroups} />
          ) : null}

          {tabId === "remotes" ? <GitRemotes remoteGroups={remoteGroups} /> : null}
        </>
      )}
    </>
  );

  const handleTabContextMenu = (
    tabId: GitTabId,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (!isSplit) return;
    setTabContextMenu({
      tabId,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const handleTabContextMenuSelect = (itemId: string) => {
    if (!tabContextMenu) return;
    const { tabId } = tabContextMenu;

    if (itemId === "move-top") {
      moveTabToGroup(tabId, "top");
      setActiveTopTab(tabId);
      setLastActiveGroup("top");
    }

    if (itemId === "move-bottom") {
      moveTabToGroup(tabId, "bottom");
      setActiveBottomTab(tabId);
      setLastActiveGroup("bottom");
    }
  };

  return (
    <aside className="git-panel" style={{ width }}>
      <div className="panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div className="panel-title">
            <Icon name="branch" size={16} />
            <span>Git Manager</span>
          </div>
          <button
            type="button"
            className={`icon-button icon-button--small ${
              isSplit ? "icon-button--pressed" : ""
            }`}
            title={isSplit ? "Disable split view" : "Enable split view"}
            aria-pressed={isSplit}
            onClick={handleToggleSplit}
          >
            <Icon name="split" size={14} />
          </button>
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

      {isSplit ? (
        <div className="git-panel-split">
          <section className="git-panel-section">
            <GitTabBar
              tabs={topTabs}
              activeTab={activeTopTab}
              draggedTabId={draggedTabId}
              dragOverTabId={dragOverTabId}
              dragOverGroup={dragOverGroup}
              groupId="top"
              onTabClick={handleTopTabClick}
              onTabContextMenu={handleTabContextMenu}
              onDragStart={(tabId) => handleDragStart("top", tabId)}
              onDragOver={(tabId) => handleDragOver("top", tabId)}
              onDrop={(tabId) => handleDrop("top", tabId)}
              onDragEnd={handleDragEnd}
              onPointerDown={(tabId) => handlePointerDown("top", tabId)}
            />
            <div className="git-panel-content">{renderTabContent(activeTopTab)}</div>
          </section>
          <section className="git-panel-section">
            <GitTabBar
              tabs={bottomTabs}
              activeTab={activeBottomTab}
              draggedTabId={draggedTabId}
              dragOverTabId={dragOverTabId}
              dragOverGroup={dragOverGroup}
              groupId="bottom"
              onTabClick={handleBottomTabClick}
              onTabContextMenu={handleTabContextMenu}
              onDragStart={(tabId) => handleDragStart("bottom", tabId)}
              onDragOver={(tabId) => handleDragOver("bottom", tabId)}
              onDrop={(tabId) => handleDrop("bottom", tabId)}
              onDragEnd={handleDragEnd}
              onPointerDown={(tabId) => handlePointerDown("bottom", tabId)}
            />
            <div className="git-panel-content">{renderTabContent(activeBottomTab)}</div>
          </section>
        </div>
      ) : (
        <>
          <GitTabBar
            tabs={tabs}
            activeTab={activeTab}
            draggedTabId={draggedTabId}
            dragOverTabId={dragOverTabId}
            dragOverGroup={dragOverGroup}
            groupId="single"
            onTabClick={handleSingleTabClick}
            onTabContextMenu={handleTabContextMenu}
            onDragStart={(tabId) => handleDragStart("single", tabId)}
            onDragOver={(tabId) => handleDragOver("single", tabId)}
            onDrop={(tabId) => handleDrop("single", tabId)}
            onDragEnd={handleDragEnd}
            onPointerDown={(tabId) => handlePointerDown("single", tabId)}
          />

          <div className="git-panel-content">{renderTabContent(activeTab)}</div>
        </>
      )}
      {tabContextMenu && isSplit ? (
        <ContextMenu
          items={tabContextItems}
          position={tabContextMenu.position}
          onSelect={handleTabContextMenuSelect}
          onClose={() => setTabContextMenu(null)}
        />
      ) : null}
    </aside>
  );
}
