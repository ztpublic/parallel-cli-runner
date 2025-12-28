import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { createPaneNode, killLayoutSessions } from "./services/sessions";
import { useLayoutState } from "./hooks/useLayoutState";
import { useClosePaneHotkey } from "./hooks/useHotkeys";
import { collectPanes } from "./types/layout";
import { TopBar } from "./components/TopBar";
import { StatusBar } from "./components/StatusBar";
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
import type { RepoInfoDto } from "./types/git";
import type {
  ChangedFile,
  CommitItem,
  RemoteItem,
  RepoBranchGroup,
  RepoGroup,
  RepoHeader,
  WorktreeItem,
} from "./types/git-ui";

function App() {
  const {
    layout,
    setLayout,
    activePaneId,
    setActivePaneId,
    appendPane,
    closePane,
    closeActivePane,
  } = useLayoutState();

  useClosePaneHotkey(closeActivePane);

  // Track layout for cleanup
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

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
    changedFilesByRepo,
    loading: gitLoading,
    error: gitError,
    refreshRepos,
    stageFiles,
    unstageFiles,
    stageAll,
    unstageAll,
    commit,
    pull,
    createBranch,
    deleteBranch,
    switchBranch,
    smartSwitchBranch,
    reset,
    revert,
    createWorktree,
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

  const [openedFolder, setOpenedFolder] = useState<string | null>(null);
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

  useEffect(() => {
    let alive = true;
    let initialNode: any = null;

    const start = async () => {
      const next = await createPaneNode({
        meta: {
          title: "Local session",
        },
      });
      initialNode = next;

      if (!alive) {
        void killLayoutSessions(next);
        return;
      }
      setLayout(next);
      setActivePaneId(next.id);
    };

    void start();

    return () => {
      alive = false;
      // If we unmount before setting layout, kill the initial node
      if (initialNode && !layoutRef.current) {
        void killLayoutSessions(initialNode);
      }
    };
  }, [setLayout, setActivePaneId]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      if (layoutRef.current) {
        void killLayoutSessions(layoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (repos.length > 0) {
      void refreshRepos();
    }
  }, [refreshRepos]);

  const handleOpenFolder = useCallback(
    async (path: string) => {
      setOpenedFolder(path);
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

  const panes = useMemo(() => collectPanes(layout), [layout]);

  const repoHeaders = useMemo<RepoHeader[]>(
    () =>
      repos.map((repo) => ({
        repoId: repo.repo_id,
        name: repo.name || repo.root_path,
        path: repo.root_path,
      })),
    [repos]
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

  const changedFileGroups = useMemo<RepoGroup<ChangedFile>[]>(
    () =>
      enabledRepoHeaders.map((repo) => ({
        repo,
        items: changedFilesByRepo[repo.repoId] ?? [],
      })),
    [enabledRepoHeaders, changedFilesByRepo]
  );

  const handleNewPane = useCallback(async () => {
    const nextIndex = panes.length + 1;
    const next = await createPaneNode({
      meta: {
        title: `Terminal ${nextIndex}`,
      },
    });
    appendPane(next);
  }, [appendPane, panes.length]);

  return (
    <main className="app-shell">
      <TopBar onOpenFolder={handleOpenFolder} />
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
        onCreateWorktree={(repoId, branchName, path) => {
          void runGitCommand("Create worktree failed", "Failed to create worktree.", () =>
            createWorktree(repoId, branchName, path)
          );
        }}
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
          layout={layout}
          panes={panes}
          activePaneId={activePaneId}
          onSetActivePane={setActivePaneId}
          onClosePane={(id) => void closePane(id)}
          onNewPane={() => void handleNewPane()}
        />
      </div>
      <StatusBar
        branch={repos.length > 1 ? "Multiple" : "Main"}
        openedFolder={openedFolder}
        repoCount={repos.length}
        errors={0}
        warnings={3}
      />
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
    </main>
  );
}

export default App;
