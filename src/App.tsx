import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { createPaneNode, killLayoutSessions } from "./services/sessions";
import { useLayoutState } from "./hooks/useLayoutState";
import { useClosePaneHotkey } from "./hooks/useHotkeys";
import { collectPanes } from "./types/layout";
import { GitPanel } from "./components/GitPanel";
import { TerminalPanel } from "./components/TerminalPanel";
import { useGitRepos } from "./hooks/git/useGitRepos";
import { useGitCommandErrorDialog } from "./hooks/git/useGitCommandErrorDialog";
import { gitScanRepos } from "./services/tauri";
import { formatInvokeError } from "./services/errors";
import { open } from "@tauri-apps/plugin-dialog";
import { RepoPickerModal } from "./components/RepoPickerModal";
import { ScanProgressModal } from "./components/ScanProgressModal";
import { GitErrorDialog } from "./components/dialogs/GitErrorDialog";
import { SmartSwitchDialog } from "./components/dialogs/SmartSwitchDialog";
import { SquashCommitsDialog } from "./components/dialogs/SquashCommitsDialog";
import type { RepoInfoDto } from "./types/git";
import type {
  ChangedFile,
  CommitItem,
  RemoteItem,
  RepoBranchGroup,
  RepoGroup,
  RepoHeader,
  StashItem,
  SubmoduleItem,
  WorktreeItem,
} from "./types/git-ui";

function App() {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    layout,
    activePaneId,
    setActivePaneId,
    appendPane,
    splitPaneInLayout,
    closeActivePane,
    closeTab,
    getTabsSnapshot,
  } = useLayoutState();

  useClosePaneHotkey(closeActivePane);

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const {
    repos,
    setRepos,
    statusByRepo,
    localBranchesByRepo,
    remoteBranchesByRepo,
    commitsByRepo,
    worktreesByRepo,
    remotesByRepo,
    submodulesByRepo,
    stashesByRepo,
    changedFilesByRepo,
    loading: gitLoading,
    error: gitError,
    refreshRepos,
    stageFiles,
    unstageFiles,
    discardFiles,
    stageAll,
    unstageAll,
    commit,
    pull,
    push,
    createBranch,
    deleteBranch,
    switchBranch,
    smartSwitchBranch,
    reset,
    revert,
    squashCommits,
    commitsInRemote,
    createWorktree,
    removeWorktree,
    applyStash,
    dropStash,
    loadMoreCommits,
    loadMoreLocalBranches,
    loadMoreRemoteBranches,
    canLoadMoreCommits,
    canLoadMoreLocalBranches,
    canLoadMoreRemoteBranches,
    isLoadingMoreCommits,
  } = useGitRepos();

  const { gitCommandError, clearGitCommandError, runGitCommand } =
    useGitCommandErrorDialog();

  const [repoCandidates, setRepoCandidates] = useState<RepoInfoDto[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [repoScanError, setRepoScanError] = useState<string | null>(null);
  const [enabledRepoIds, setEnabledRepoIds] = useState<string[]>([]);
  
  const [smartSwitchDialog, setSmartSwitchDialog] = useState<{
    open: boolean;
    repoId: string;
    branchName: string;
  }>({ open: false, repoId: "", branchName: "" });
  const [squashDialog, setSquashDialog] = useState<{
    open: boolean;
    repoId: string;
    commitIds: string[];
  }>({ open: false, repoId: "", commitIds: [] });

  const startResizing = useCallback(() => {
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    const newWidth = Math.max(240, Math.min(e.clientX, 800));
    setSidebarWidth(newWidth);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      const tabs = getTabsSnapshot();
      tabs.forEach((tab) => {
        void killLayoutSessions(tab.layout);
      });
    };
  }, [getTabsSnapshot]);

  useEffect(() => {
    if (repos.length > 0) {
      void refreshRepos();
    }
  }, [repos, refreshRepos]);

  const handleOpenFolder = useCallback(
    async (path: string) => {
      setRepoScanError(null);
      setIsScanning(true);
      try {
        const repos = await gitScanRepos({ cwd: path });
        setRepoCandidates(repos);
        setSelectedRepoIds(repos.map((repo) => repo.repo_id));
        setIsRepoPickerOpen(true);
      } catch (err) {
        const message = formatInvokeError(err);
        setRepoScanError(message === "Unexpected error." ? "Failed to scan repos." : message);
        setRepoCandidates([]);
        setSelectedRepoIds([]);
        // Still open the picker to show the error
        setIsRepoPickerOpen(true);
      } finally {
        setIsScanning(false);
      }
    },
    []
  );

  const handleTriggerOpenFolder = useCallback(async () => {
    try {
      const selection = await open({
        directory: true,
        multiple: false,
        title: "Open Folder",
      });
      if (typeof selection === "string") {
        void handleOpenFolder(selection);
      } else if (Array.isArray(selection) && selection[0]) {
        void handleOpenFolder(selection[0]);
      }
    } catch (error) {
      console.error("Failed to open folder picker", error);
    }
  }, [handleOpenFolder]);

  const handleToggleRepo = useCallback((repoId: string) => {
    setSelectedRepoIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    );
  }, []);

  const handleSelectAllRepos = useCallback(() => {
    setSelectedRepoIds(repoCandidates.map((repo) => repo.repo_id));
  }, [repoCandidates]);

  const handleClearRepos = useCallback(() => {
    setSelectedRepoIds([]);
  }, []);

  const handleConfirmRepos = useCallback(() => {
    const selected = repoCandidates.filter((repo) =>
      selectedRepoIds.includes(repo.repo_id)
    );
    setRepos(selected);
    setEnabledRepoIds(selected.map((r) => r.repo_id));
    setIsRepoPickerOpen(false);
  }, [repoCandidates, selectedRepoIds, setRepos]);

  const handleCloseRepoPicker = useCallback(() => {
    setIsRepoPickerOpen(false);
  }, []);

  const handleRemoveRepo = useCallback((repoId: string) => {
    setRepos(repos.filter((r) => r.repo_id !== repoId));
    setEnabledRepoIds((prev) => prev.filter((id) => id !== repoId));
  }, [repos, setRepos]);

  const activePanes = useMemo(() => collectPanes(layout), [layout]);
  const resolvedActiveTabId = activeTabId ?? tabs[0]?.id ?? null;

  const repoHeaders = useMemo<RepoHeader[]>(
    () =>
      repos.map((repo) => ({
        repoId: repo.repo_id,
        name: repo.name || repo.root_path,
        path: repo.root_path,
        activeBranch: statusByRepo[repo.repo_id]?.branch,
      })),
    [repos, statusByRepo]
  );

  const enabledRepoHeaders = useMemo<RepoHeader[]>(
    () => repoHeaders.filter((r) => enabledRepoIds.includes(r.repoId)),
    [repoHeaders, enabledRepoIds]
  );

  const branchGroups = useMemo<RepoBranchGroup[]>(
    () =>
      enabledRepoHeaders.map((repo) => ({
        repo,
        localBranches: localBranchesByRepo[repo.repoId] ?? [],
        remoteBranches: remoteBranchesByRepo[repo.repoId] ?? [],
      })),
    [localBranchesByRepo, remoteBranchesByRepo, enabledRepoHeaders]
  );

  const commitGroups = useMemo<RepoGroup<CommitItem>[]>(
    () =>
      enabledRepoHeaders.map((repo) => ({
        repo,
        items: commitsByRepo[repo.repoId] ?? [],
      })),
    [commitsByRepo, enabledRepoHeaders]
  );

  const worktreeGroups = useMemo<RepoGroup<WorktreeItem>[]>(
    () =>
      enabledRepoHeaders.map((repo) => ({
        repo,
        items: worktreesByRepo[repo.repoId] ?? [],
      })),
    [enabledRepoHeaders, worktreesByRepo]
  );

  const remoteGroups = useMemo<RepoGroup<RemoteItem>[]>(
    () =>
      enabledRepoHeaders.map((repo) => ({
        repo,
        items: remotesByRepo[repo.repoId] ?? [],
      })),
    [enabledRepoHeaders, remotesByRepo]
  );

  const submoduleGroups = useMemo<RepoGroup<SubmoduleItem>[]>(
    () =>
      repoHeaders.map((repo) => ({
        repo,
        items: submodulesByRepo[repo.repoId] ?? [],
      })),
    [repoHeaders, submodulesByRepo]
  );

  const stashGroups = useMemo<RepoGroup<StashItem>[]>(
    () =>
      enabledRepoHeaders.map((repo) => ({
        repo,
        items: stashesByRepo[repo.repoId] ?? [],
      })),
    [enabledRepoHeaders, stashesByRepo]
  );

  const changedFileGroups = useMemo<RepoGroup<ChangedFile>[]>(
    () =>
      enabledRepoHeaders.map((repo) => ({
        repo,
        items: changedFilesByRepo[repo.repoId] ?? [],
      })),
    [enabledRepoHeaders, changedFilesByRepo]
  );

  const openTerminalAt = useCallback(
    async ({ cwd, title, subtitle }: { cwd: string; title: string; subtitle?: string }) => {
      const next = await createPaneNode({
        cwd,
        meta: { title, subtitle },
      });
      appendPane(next, title);
    },
    [appendPane]
  );

  const handleOpenRepoTerminal = useCallback(
    (repo: RepoHeader) => {
      void openTerminalAt({ cwd: repo.path, title: repo.name, subtitle: repo.path });
    },
    [openTerminalAt]
  );

  const handleOpenWorktreeTerminal = useCallback(
    (repo: RepoHeader, worktree: WorktreeItem) => {
      void openTerminalAt({
        cwd: worktree.path,
        title: `${repo.name}:${worktree.branch}`,
        subtitle: worktree.path,
      });
    },
    [openTerminalAt]
  );

  const handleNewPane = useCallback(async () => {
    const nextIndex = tabs.length + 1;
    const title = `Terminal ${nextIndex}`;
    const next = await createPaneNode({
      meta: {
        title,
      },
    });
    appendPane(next, title);
  }, [appendPane, tabs.length]);

  const handleSplitPane = useCallback(async () => {
    const targetPaneId = activePaneId ?? activePanes[0]?.id;
    if (!targetPaneId) return;
    const nextIndex = activePanes.length + 1;
    const next = await createPaneNode({
      meta: {
        title: `Terminal ${nextIndex}`,
      },
    });
    splitPaneInLayout(next, targetPaneId, "horizontal");
  }, [activePaneId, activePanes, splitPaneInLayout]);

  return (
    <main className="app-shell">
      <div className="workspace" style={{ position: "relative" }}>
      <GitPanel
        width={sidebarWidth}
        loading={gitLoading}
        error={gitError}
        repos={repoHeaders}
        enabledRepoIds={enabledRepoIds}
        onEnableRepos={setEnabledRepoIds}
        branchGroups={branchGroups}
        commitGroups={commitGroups}
        worktreeGroups={worktreeGroups}
        remoteGroups={remoteGroups}
        submoduleGroups={submoduleGroups}
        stashGroups={stashGroups}
        changedFileGroups={changedFileGroups}
        onRemoveRepo={handleRemoveRepo}
        onRefresh={() => {
          void runGitCommand("Refresh failed", "Failed to refresh git data.", () => refreshRepos());
        }}
        onStageAll={(repoId) => {
          void runGitCommand("Stage all failed", "Failed to stage all files.", () =>
            stageAll(repoId)
          );
        }}
        onUnstageAll={(repoId) => {
          void runGitCommand("Unstage all failed", "Failed to unstage all files.", () =>
            unstageAll(repoId)
          );
        }}
        onStageFile={(repoId, path) => {
          void runGitCommand("Stage file failed", "Failed to stage file.", () =>
            stageFiles(repoId, [path])
          );
        }}
        onUnstageFile={(repoId, path) => {
          void runGitCommand("Unstage file failed", "Failed to unstage file.", () =>
            unstageFiles(repoId, [path])
          );
        }}
        onRollbackFiles={(repoId, paths) => {
          void runGitCommand("Roll back failed", "Failed to roll back files.", () =>
            discardFiles(repoId, paths)
          );
        }}
        onCommit={(repoId, message) => {
          void runGitCommand("Commit failed", "Failed to commit changes.", () =>
            commit(repoId, message)
          );
        }}
        onPull={(repoId) => {
          void runGitCommand("Pull failed", "Failed to pull changes.", () =>
            pull(repoId)
          );
        }}
        onPush={(repoId, force) => {
          void runGitCommand("Push failed", "Failed to push changes.", () =>
            push(repoId, force)
          );
        }}
        onCreateBranch={(repoId, name, source) => {
          void runGitCommand("Create branch failed", "Failed to create branch.", () =>
            createBranch(repoId, name, source)
          );
        }}
        onDeleteBranch={(repoId, branchName) => {
          void runGitCommand("Delete branch failed", "Failed to delete branch.", () =>
            deleteBranch(repoId, branchName)
          );
        }}
        onSwitchBranch={(repoId, branchName) => {
          const status = statusByRepo[repoId];
          if (status && (status.has_staged || status.has_unstaged)) {
            setSmartSwitchDialog({ open: true, repoId, branchName });
            return;
          }
          void runGitCommand("Switch branch failed", "Failed to switch branch.", () =>
            switchBranch(repoId, branchName)
          );
        }}
        onReset={(repoId, commitId, mode) => {
          void runGitCommand("Reset failed", "Failed to reset commit.", () =>
            reset(repoId, commitId, mode)
          );
        }}
        onRevert={(repoId, commitId) => {
          void runGitCommand("Revert failed", "Failed to revert commit.", () =>
            revert(repoId, commitId)
          );
        }}
        onSquashCommits={(repoId, commitIds) => {
          void runGitCommand("Squash failed", "Failed to squash commits.", async () => {
            const alreadyInRemote = await commitsInRemote(repoId, commitIds);
            if (alreadyInRemote) {
              setSquashDialog({ open: true, repoId, commitIds });
              return;
            }
            await squashCommits(repoId, commitIds);
          });
        }}
        onCreateWorktree={(repoId, branchName, path) => {
          void runGitCommand("Create worktree failed", "Failed to create worktree.", () =>
            createWorktree(repoId, branchName, path)
          );
        }}
        onDeleteWorktree={(repoId, branchName) => {
          void runGitCommand("Delete worktree failed", "Failed to delete worktree.", () =>
            removeWorktree(repoId, branchName)
          );
        }}
        onApplyStash={(repoId, stashIndex) => {
          void runGitCommand("Apply stash failed", "Failed to apply stash.", () =>
            applyStash(repoId, stashIndex)
          );
        }}
        onDeleteStash={(repoId, stashIndex) => {
          void runGitCommand("Delete stash failed", "Failed to delete stash.", () =>
            dropStash(repoId, stashIndex)
          );
        }}
        onOpenRepoTerminal={handleOpenRepoTerminal}
        onOpenWorktreeTerminal={handleOpenWorktreeTerminal}
        onOpenFolder={handleTriggerOpenFolder}
        onLoadMoreCommits={(repoId) => {
          void runGitCommand("Load commits failed", "Failed to load more commits.", () =>
            loadMoreCommits(repoId)
          );
        }}
        onLoadMoreLocalBranches={loadMoreLocalBranches}
        onLoadMoreRemoteBranches={loadMoreRemoteBranches}
        canLoadMoreCommits={canLoadMoreCommits}
        canLoadMoreLocalBranches={canLoadMoreLocalBranches}
        canLoadMoreRemoteBranches={canLoadMoreRemoteBranches}
        isLoadingMoreCommits={isLoadingMoreCommits}
      />
        <div
          className={`resize-handle ${isResizing ? "is-resizing" : ""}`}
          style={{ left: sidebarWidth - 3 }}
          onMouseDown={startResizing}
        />
        <TerminalPanel
          tabs={tabs}
          activeTabId={resolvedActiveTabId}
          onSetActiveTab={setActiveTabId}
          onSetActivePane={setActivePaneId}
          onCloseTab={(id) => closeTab(id)}
          onNewPane={() => void handleNewPane()}
          onSplitPane={() => void handleSplitPane()}
        />
      </div>
      <ScanProgressModal open={isScanning} />
      <RepoPickerModal
        open={isRepoPickerOpen}
        repos={repoCandidates}
        selectedRepoIds={selectedRepoIds}
        error={repoScanError}
        onToggleRepo={handleToggleRepo}
        onSelectAll={handleSelectAllRepos}
        onClear={handleClearRepos}
        onConfirm={handleConfirmRepos}
        onClose={handleCloseRepoPicker}
      />
      <GitErrorDialog
        open={Boolean(gitCommandError)}
        title={gitCommandError?.title}
        message={gitCommandError?.message ?? ""}
        onClose={clearGitCommandError}
      />
      <SmartSwitchDialog
        open={smartSwitchDialog.open}
        branchName={smartSwitchDialog.branchName}
        onClose={() => setSmartSwitchDialog((prev) => ({ ...prev, open: false }))}
        onConfirmForce={() => {
          void runGitCommand("Switch branch failed", "Failed to force switch branch.", () =>
            switchBranch(smartSwitchDialog.repoId, smartSwitchDialog.branchName)
          );
        }}
        onConfirmSmart={() => {
          void runGitCommand("Smart switch failed", "Failed to smart switch branch.", () =>
            smartSwitchBranch(smartSwitchDialog.repoId, smartSwitchDialog.branchName)
          );
        }}
      />
      <SquashCommitsDialog
        open={squashDialog.open}
        commitCount={squashDialog.commitIds.length}
        onClose={() => setSquashDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={() => {
          void runGitCommand("Squash failed", "Failed to squash commits.", () =>
            squashCommits(squashDialog.repoId, squashDialog.commitIds)
          );
        }}
      />
    </main>
  );
}

export default App;
