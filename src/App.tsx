import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { createPaneNode, killLayoutSessions } from "./services/sessions";
import { useLayoutState } from "./hooks/useLayoutState";
import { useClosePaneHotkey } from "./hooks/useHotkeys";
import { collectPanes, countPanes, findPane, getFirstPane } from "./types/layout";
import { GitPanel } from "./components/GitPanel";
import { TerminalPanel } from "./components/TerminalPanel";
import { useGitRepos } from "./hooks/git/useGitRepos";
import { makeWorktreeTargetId } from "./hooks/git/gitTargets";
import { useGitCommandErrorDialog } from "./hooks/git/useGitCommandErrorDialog";
import { gitScanRepos } from "./services/backend";
import { formatInvokeError } from "./services/errors";
import { openDialog, openPath } from "./platform/actions";
import { RepoPickerModal } from "./components/RepoPickerModal";
import { ScanProgressModal } from "./components/ScanProgressModal";
import { GitErrorDialog } from "./components/dialogs/GitErrorDialog";
import { RebaseWorktreeGuardDialog } from "./components/dialogs/RebaseWorktreeGuardDialog";
import { SmartSwitchDialog } from "./components/dialogs/SmartSwitchDialog";
import { SquashCommitsDialog } from "./components/dialogs/SquashCommitsDialog";
import type { RepoInfoDto } from "./types/git";
import type {
  ChangedFile,
  RemoteItem,
  RepoBranchGroup,
  RepoGroup,
  RepoHeader,
  StashItem,
  SubmoduleItem,
  WorktreeCommits,
  WorktreeItem,
} from "./types/git-ui";

function App() {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    setActivePaneId,
    appendPane,
    splitPaneInTab,
    closePanesInTab,
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
    statusByWorktreeByRepo,
    localBranchesByRepo,
    remoteBranchesByRepo,
    worktreeCommitsByRepo,
    worktreesByRepo,
    remotesByRepo,
    submodulesByRepo,
    stashesByRepo,
    changedFilesByRepo,
    changedFilesByWorktreeByRepo,
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
    mergeIntoBranch,
    rebaseBranch,
    checkoutBranchAtPath,
    detachWorktreeHead,
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

  const { gitCommandError, clearGitCommandError, runGitCommand, showGitCommandError } =
    useGitCommandErrorDialog();

  const [repoCandidates, setRepoCandidates] = useState<RepoInfoDto[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [repoScanError, setRepoScanError] = useState<string | null>(null);
  const [enabledRepoIds, setEnabledRepoIds] = useState<string[]>([]);
  const [terminalSplitPaneIds, setTerminalSplitPaneIds] = useState<
    Record<string, string[]>
  >({});
  const [terminalSplitViews, setTerminalSplitViews] = useState<
    Record<string, "single" | "vertical" | "horizontal" | "quad">
  >({});
  const [terminalLayoutTick, setTerminalLayoutTick] = useState(0);
  
  const [smartSwitchDialog, setSmartSwitchDialog] = useState<{
    open: boolean;
    repoId: string;
    branchName: string;
  }>({ open: false, repoId: "", branchName: "" });
  const [squashDialog, setSquashDialog] = useState<{
    open: boolean;
    repoId: string;
    worktreePath: string;
    commitIds: string[];
  }>({ open: false, repoId: "", worktreePath: "", commitIds: [] });
  const [rebaseGuardDialog, setRebaseGuardDialog] = useState<{
    open: boolean;
    repoId: string;
    targetBranch: string;
    ontoBranch: string;
    worktreePath: string;
    hasDirtyWorktree: boolean;
  }>({
    open: false,
    repoId: "",
    targetBranch: "",
    ontoBranch: "",
    worktreePath: "",
    hasDirtyWorktree: false,
  });

  useEffect(() => {
    setTerminalSplitPaneIds((prev) => {
      let changed = false;
      const next = { ...prev };
      const tabIds = new Set(tabs.map((tab) => tab.id));
      Object.keys(next).forEach((tabId) => {
        if (!tabIds.has(tabId)) {
          delete next[tabId];
          changed = true;
        }
      });
      tabs.forEach((tab) => {
        const splitPaneIds = prev[tab.id] ?? [];
        if (!splitPaneIds.length) return;
        const nextIds = splitPaneIds.filter((id) => findPane(tab.layout, id));
        if (nextIds.length !== splitPaneIds.length) {
          next[tab.id] = nextIds;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setTerminalSplitViews((prev) => {
      let changed = false;
      const next = { ...prev };
      const tabIds = new Set(tabs.map((tab) => tab.id));
      Object.keys(next).forEach((tabId) => {
        if (!tabIds.has(tabId)) {
          delete next[tabId];
          changed = true;
        }
      });
      tabs.forEach((tab) => {
        const splitPaneIds = terminalSplitPaneIds[tab.id] ?? [];
        if (!splitPaneIds.length && next[tab.id] && next[tab.id] !== "single") {
          next[tab.id] = "single";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [tabs, terminalSplitPaneIds]);

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
      const selection = await openDialog({
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

  const commitGroups = useMemo<RepoGroup<WorktreeCommits>[]>(
    () =>
      enabledRepoHeaders.map((repo) => ({
        repo,
        items: (worktreesByRepo[repo.repoId] ?? []).map((worktree) => ({
          worktree,
          commits: worktreeCommitsByRepo[repo.repoId]?.[worktree.path] ?? [],
        })),
      })),
    [enabledRepoHeaders, worktreesByRepo, worktreeCommitsByRepo]
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

  const changedFileGroups = useMemo<RepoGroup<ChangedFile>[]>(() => {
    const repoGroups = enabledRepoHeaders.map((repo) => ({
      repo,
      items: changedFilesByRepo[repo.repoId] ?? [],
    }));
    const worktreeGroups = enabledRepoHeaders.flatMap((repo) => {
      const worktrees = worktreesByRepo[repo.repoId] ?? [];
      const worktreeByPath = new Map(worktrees.map((worktree) => [worktree.path, worktree]));
      const statusByPath = statusByWorktreeByRepo[repo.repoId] ?? {};
      const paths = new Set([...worktreeByPath.keys(), ...Object.keys(statusByPath)]);

      return Array.from(paths)
        .filter((path) => path !== repo.path)
        .map((path) => {
          const worktree = worktreeByPath.get(path);
          const branchName = worktree?.branch ?? statusByPath[path]?.branch ?? "HEAD";

          return {
            repo: {
              repoId: makeWorktreeTargetId(repo.repoId, path),
              name: `${repo.name}:${branchName}`,
              path,
              activeBranch: branchName,
            },
            items: changedFilesByWorktreeByRepo[repo.repoId]?.[path] ?? [],
          };
        });
    });
    return [...repoGroups, ...worktreeGroups];
  }, [
    enabledRepoHeaders,
    changedFilesByRepo,
    worktreesByRepo,
    statusByWorktreeByRepo,
    changedFilesByWorktreeByRepo,
  ]);

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

  const handleOpenRepoFolder = useCallback(
    async (repo: RepoHeader) => {
      try {
        await openPath(repo.path);
      } catch (error) {
        showGitCommandError("Open folder failed", error, "Failed to open repo folder.");
      }
    },
    [showGitCommandError]
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

  const handleOpenWorktreeFolder = useCallback(
    async (_repo: RepoHeader, worktree: WorktreeItem) => {
      try {
        await openPath(worktree.path);
      } catch (error) {
        showGitCommandError(
          "Open folder failed",
          error,
          "Failed to open worktree folder."
        );
      }
    },
    [showGitCommandError]
  );

  const handleRebaseBranch = useCallback(
    (repoId: string, targetBranch: string, ontoBranch: string) => {
      const repo = repoHeaders.find((item) => item.repoId === repoId);
      if (!repo) {
        void runGitCommand("Rebase failed", "Failed to rebase branch.", () =>
          rebaseBranch(repoId, targetBranch, ontoBranch)
        );
        return;
      }
      const worktrees = worktreesByRepo[repoId] ?? [];
      const blockingWorktree = worktrees.find(
        (worktree) => worktree.branch === targetBranch && worktree.path !== repo.path
      );

      if (blockingWorktree) {
        const status = statusByWorktreeByRepo[repoId]?.[blockingWorktree.path];
        const hasDirtyWorktree =
          Boolean(status?.has_staged || status?.has_unstaged || status?.has_untracked) ||
          (status?.conflicted_files ?? 0) > 0;
        setRebaseGuardDialog({
          open: true,
          repoId,
          targetBranch,
          ontoBranch,
          worktreePath: blockingWorktree.path,
          hasDirtyWorktree,
        });
        return;
      }

      void runGitCommand("Rebase failed", "Failed to rebase branch.", () =>
        rebaseBranch(repoId, targetBranch, ontoBranch)
      );
    },
    [repoHeaders, rebaseBranch, runGitCommand, statusByWorktreeByRepo, worktreesByRepo]
  );

  const handleDetachAndRebase = useCallback(() => {
    const { repoId, targetBranch, ontoBranch, worktreePath } = rebaseGuardDialog;
    if (!repoId || !targetBranch || !ontoBranch || !worktreePath) return;
    void runGitCommand(
      "Rebase failed",
      "Failed to detach the other worktree and rebase the branch.",
      async () => {
        await detachWorktreeHead(repoId, worktreePath);
        await rebaseBranch(repoId, targetBranch, ontoBranch);
        await checkoutBranchAtPath(repoId, worktreePath, targetBranch);
      }
    );
  }, [
    checkoutBranchAtPath,
    detachWorktreeHead,
    rebaseBranch,
    rebaseGuardDialog,
    runGitCommand,
  ]);

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

  const handleSetTerminalView = useCallback(
    async (tabId: string, view: "single" | "vertical" | "horizontal" | "quad") => {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab) return;

      const existingView = terminalSplitViews[tabId] ?? "single";
      if (view === existingView) return;

      const splitPaneIds = terminalSplitPaneIds[tabId] ?? [];
      if (splitPaneIds.length) {
        await closePanesInTab(tabId, splitPaneIds);
      }

      if (view === "single") {
        setTerminalSplitPaneIds((prev) => ({ ...prev, [tabId]: [] }));
        setTerminalSplitViews((prev) => ({ ...prev, [tabId]: "single" }));
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
        setTerminalLayoutTick((tick) => tick + 1);
        return;
      }

      let targetPaneId = tab.activePaneId;
      if (splitPaneIds.length) {
        const allPanes = collectPanes(tab.layout);
        const survivor = allPanes.find((p) => !splitPaneIds.includes(p.id));
        if (survivor) {
          targetPaneId = survivor.id;
        }
      }
      if (!targetPaneId) targetPaneId = getFirstPane(tab.layout)?.id ?? null;

      if (!targetPaneId) return;
      const targetPane = findPane(tab.layout, targetPaneId);
      const cwd = targetPane?.meta?.cwd ?? targetPane?.meta?.subtitle;
      const subtitle = targetPane?.meta?.subtitle;
      const baseIndex = countPanes(tab.layout);

      const createSplitPane = async (indexOffset: number) =>
        createPaneNode({
          cwd,
          meta: {
            title: `Terminal ${baseIndex + indexOffset}`,
            subtitle,
            cwd,
          },
        });

      if (view === "vertical" || view === "horizontal") {
        const next = await createSplitPane(1);
        splitPaneInTab(tabId, next, targetPaneId, view === "vertical" ? "vertical" : "horizontal");
        setTerminalSplitPaneIds((prev) => ({ ...prev, [tabId]: [next.id] }));
        setTerminalSplitViews((prev) => ({ ...prev, [tabId]: view }));
      } else {
        const paneA = await createSplitPane(1);
        splitPaneInTab(tabId, paneA, targetPaneId, "vertical");

        const paneB = await createSplitPane(2);
        splitPaneInTab(tabId, paneB, targetPaneId, "horizontal");

        const paneC = await createSplitPane(3);
        splitPaneInTab(tabId, paneC, paneA.id, "horizontal");

        setTerminalSplitPaneIds((prev) => ({
          ...prev,
          [tabId]: [paneA.id, paneB.id, paneC.id],
        }));
        setTerminalSplitViews((prev) => ({ ...prev, [tabId]: "quad" }));
      }

      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
      setTerminalLayoutTick((tick) => tick + 1);
    },
    [closePanesInTab, splitPaneInTab, tabs, terminalSplitPaneIds, terminalSplitViews]
  );

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
          return runGitCommand("Stage all failed", "Failed to stage all files.", () =>
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
          return runGitCommand("Commit failed", "Failed to commit changes.", () =>
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
        onMergeBranch={(repoId, targetBranch, sourceBranch) => {
          void runGitCommand("Merge failed", "Failed to merge branch.", () =>
            mergeIntoBranch(repoId, targetBranch, sourceBranch)
          );
        }}
        onRebaseBranch={handleRebaseBranch}
        onReset={(repoId, worktreePath, commitId, mode) => {
          void runGitCommand("Reset failed", "Failed to reset commit.", () =>
            reset(repoId, commitId, mode, worktreePath)
          );
        }}
        onRevert={(repoId, worktreePath, commitId) => {
          void runGitCommand("Revert failed", "Failed to revert commit.", () =>
            revert(repoId, commitId, worktreePath)
          );
        }}
        onSquashCommits={(repoId, worktreePath, commitIds) => {
          void runGitCommand("Squash failed", "Failed to squash commits.", async () => {
            const alreadyInRemote = await commitsInRemote(repoId, commitIds, worktreePath);
            if (alreadyInRemote) {
              setSquashDialog({ open: true, repoId, worktreePath, commitIds });
              return;
            }
            await squashCommits(repoId, commitIds, worktreePath);
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
        onOpenRepoFolder={handleOpenRepoFolder}
        onOpenWorktreeTerminal={handleOpenWorktreeTerminal}
        onOpenWorktreeFolder={handleOpenWorktreeFolder}
        onOpenFolder={handleTriggerOpenFolder}
        onLoadMoreCommits={(repoId, worktreePath) => {
          void runGitCommand("Load commits failed", "Failed to load more commits.", () =>
            loadMoreCommits(repoId, worktreePath)
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
          terminalSplitPaneIds={terminalSplitPaneIds}
          terminalSplitViews={terminalSplitViews}
          layoutTick={terminalLayoutTick}
          onSetActiveTab={setActiveTabId}
          onSetActivePane={setActivePaneId}
          onCloseTab={(id) => closeTab(id)}
          onNewPane={() => void handleNewPane()}
          onSetTerminalView={(tabId, view) => void handleSetTerminalView(tabId, view)}
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
      <RebaseWorktreeGuardDialog
        open={rebaseGuardDialog.open}
        targetBranch={rebaseGuardDialog.targetBranch}
        ontoBranch={rebaseGuardDialog.ontoBranch}
        worktreePath={rebaseGuardDialog.worktreePath}
        hasDirtyWorktree={rebaseGuardDialog.hasDirtyWorktree}
        onClose={() => setRebaseGuardDialog((prev) => ({ ...prev, open: false }))}
        onConfirmDetach={handleDetachAndRebase}
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
            squashCommits(squashDialog.repoId, squashDialog.commitIds, squashDialog.worktreePath)
          );
        }}
      />
    </main>
  );
}

export default App;
