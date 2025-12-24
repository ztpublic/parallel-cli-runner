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
import { gitScanRepos } from "./services/tauri";
import { open } from "@tauri-apps/plugin-dialog";
import { RepoPickerModal } from "./components/RepoPickerModal";
import { ScanProgressModal } from "./components/ScanProgressModal";
import type { RepoInfoDto } from "./types/git";
import type {
  CommitItem,
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
    activeRepoId,
    activeStatus,
    localBranchesByRepo,
    remoteBranchesByRepo,
    commitsByRepo,
    worktreesByRepo,
    activeRemotes,
    activeChangedFiles,
    loading: gitLoading,
    error: gitError,
    refreshRepos,
    stageFiles,
    unstageFiles,
    stageAll,
    unstageAll,
    commit,
    createBranch,
    switchBranch,
    reset,
    revert,
    loadMoreCommits,
    loadMoreLocalBranches,
    loadMoreRemoteBranches,
    canLoadMoreCommits,
    canLoadMoreLocalBranches,
    canLoadMoreRemoteBranches,
    isLoadingMoreCommits,
  } = useGitRepos();

  const [openedFolder, setOpenedFolder] = useState<string | null>(null);
  const [repoCandidates, setRepoCandidates] = useState<RepoInfoDto[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [repoScanError, setRepoScanError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!activeRepoId) return;
    void refreshRepos(activeRepoId);
  }, [activeRepoId, refreshRepos]);

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
        const message = err instanceof Error ? err.message : "Failed to scan repos";
        setRepoScanError(message);
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
    setIsRepoPickerOpen(false);
  }, [repoCandidates, selectedRepoIds, setRepos]);

  const handleCloseRepoPicker = useCallback(() => {
    setIsRepoPickerOpen(false);
  }, []);

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

  const branchGroups = useMemo<RepoBranchGroup[]>(
    () =>
      repoHeaders.map((repo) => ({
        repo,
        localBranches: localBranchesByRepo[repo.repoId] ?? [],
        remoteBranches: remoteBranchesByRepo[repo.repoId] ?? [],
      })),
    [localBranchesByRepo, remoteBranchesByRepo, repoHeaders]
  );

  const commitGroups = useMemo<RepoGroup<CommitItem>[]>(
    () =>
      repoHeaders.map((repo) => ({
        repo,
        items: commitsByRepo[repo.repoId] ?? [],
      })),
    [commitsByRepo, repoHeaders]
  );

  const worktreeGroups = useMemo<RepoGroup<WorktreeItem>[]>(
    () =>
      repoHeaders.map((repo) => ({
        repo,
        items: worktreesByRepo[repo.repoId] ?? [],
      })),
    [repoHeaders, worktreesByRepo]
  );

  const activeRepoName = useMemo(() => {
    if (!activeRepoId) return null;
    const repo = repos.find((entry) => entry.repo_id === activeRepoId);
    return repo?.name || repo?.root_path || null;
  }, [activeRepoId, repos]);

  const branchLabel = useMemo(() => {
    if (!activeRepoId && repos.length > 1) return "Multiple";
    return activeStatus?.branch ?? "No repo";
  }, [activeRepoId, activeStatus?.branch, repos.length]);

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
        repoRoot={activeRepoId}
        loading={gitLoading}
        error={gitError}
        branchGroups={branchGroups}
        commitGroups={commitGroups}
        worktreeGroups={worktreeGroups}
        remotes={activeRemotes}
        changedFiles={activeChangedFiles}
        onRefresh={() => void refreshRepos()}
        onStageAll={() => {
          if (activeRepoId) void stageAll(activeRepoId);
        }}
        onUnstageAll={() => {
          if (activeRepoId) void unstageAll(activeRepoId);
        }}
        onStageFile={(path) => {
          if (activeRepoId) void stageFiles(activeRepoId, [path]);
        }}
        onUnstageFile={(path) => {
          if (activeRepoId) void unstageFiles(activeRepoId, [path]);
        }}
        onCommit={(message) => {
          if (activeRepoId) void commit(activeRepoId, message);
        }}
        onCreateBranch={(repoId, name, source) => {
          void createBranch(repoId, name, source);
        }}
        onSwitchBranch={(repoId, branchName) => {
          void switchBranch(repoId, branchName);
        }}
        onReset={(repoId, commitId, mode) => {
          void reset(repoId, commitId, mode);
        }}
        onRevert={(repoId, commitId) => {
          void revert(repoId, commitId);
        }}
        onOpenFolder={handleTriggerOpenFolder}
        onLoadMoreCommits={loadMoreCommits}
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
        branch={branchLabel}
        openedFolder={openedFolder}
        repoCount={repos.length}
        activeRepoName={activeRepoName}
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
    </main>
  );
}

export default App;
