import { useCallback, useEffect, useMemo } from "react";
import { GitPanel } from "../components/GitPanel";
import { useGitRepos } from "../hooks/git/useGitRepos";
import { useGitCommandErrorDialog } from "../hooks/git/useGitCommandErrorDialog";
import { makeWorktreeTargetId } from "../hooks/git/gitTargets";
import { openPath } from "../platform/actions";
import { createPaneNode, createAgentPaneNode } from "../services/sessions";
import type { RepoInfoDto } from "../types/git";
import type { PaneNode } from "../types/layout";
import type {
  ChangedFile,
  RemoteItem,
  RepoBranchGroup,
  RepoGroup,
  RepoHeader,
  StashItem,
  SubmoduleItem,
  TagItem,
  WorktreeCommits,
  WorktreeItem,
} from "../types/git-ui";

interface GitPanelContainerProps {
  repos: RepoInfoDto[];
  enabledRepoIds: string[];
  setEnabledRepoIds: (ids: string[]) => void;
  onRemoveRepo: (repoId: string) => void;
  onTriggerOpenFolder: () => void;
  width: number;
  gitRefreshRequest: { seq: number; repoId: string | null };
  onRebaseBranch?: (
    repoId: string,
    targetBranch: string,
    ontoBranch: string
  ) => void;
  onSwitchBranchWithCheck?: (
    repoId: string,
    branchName: string
  ) => void;
  onSquashCommitsWithCheck?: (
    repoId: string,
    worktreePath: string,
    commitIds: string[]
  ) => void;
  appendPane: (pane: PaneNode, title?: string) => void;
}

export function GitPanelContainer({
  repos,
  enabledRepoIds,
  setEnabledRepoIds,
  onRemoveRepo,
  onTriggerOpenFolder,
  width,
  gitRefreshRequest,
  onRebaseBranch,
  onSwitchBranchWithCheck,
  onSquashCommitsWithCheck,
  appendPane,
}: GitPanelContainerProps) {
  const {
    statusByRepo,
    statusByWorktreeByRepo,
    localBranchesByRepo,
    remoteBranchesByRepo,
    worktreeCommitsByRepo,
    worktreesByRepo,
    worktreeUniqueCommitsByRepo,
    fetchWorktreeCommits,
    isLoadingWorktreeCommits,
    remotesByRepo,
    submodulesByRepo,
    stashesByRepo,
    tagsByRepo,
    changedFilesByRepo,
    changedFilesByWorktreeByRepo,
    loading: gitLoading,
    error: gitError,
    setRepos,
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
    createBranch,
    deleteBranch,
    switchBranch,
    smartUpdateWorktrees,
    reset,
    revert,
    squashCommits,
    commitsInRemote,
    createWorktree,
    removeWorktree,
    applyStash,
    dropStash,
    createStash,
    loadMoreTags,
    canLoadMoreTags,
    isLoadingMoreTags,
    loadMoreCommits,
    loadMoreLocalBranches,
    loadMoreRemoteBranches,
    canLoadMoreCommits,
    canLoadMoreLocalBranches,
    canLoadMoreRemoteBranches,
    isLoadingMoreCommits,
  } = useGitRepos();

  const { runGitCommand, showGitCommandError } = useGitCommandErrorDialog();

  useEffect(() => {
    setRepos(repos);
  }, [repos, setRepos]);

  useEffect(() => {
    if (!repos.length) return;
    void refreshRepos();
  }, [repos, refreshRepos]);

  useEffect(() => {
    if (!repos.length) return;
    if (gitRefreshRequest.seq === 0) return;
    void refreshRepos(gitRefreshRequest.repoId ?? undefined);
  }, [gitRefreshRequest.repoId, gitRefreshRequest.seq, refreshRepos, repos.length]);

  useEffect(() => {
    for (const repo of repos) {
      const activeBranch = statusByRepo[repo.repo_id]?.branch;
      if (activeBranch && worktreesByRepo[repo.repo_id]?.length > 0) {
        void fetchWorktreeCommits(repo.repo_id, repo.root_path, activeBranch);
      }
    }
  }, [statusByRepo, worktreesByRepo, fetchWorktreeCommits, repos]);

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

  const tagGroups = useMemo<RepoGroup<TagItem>[]>(
    () =>
      enabledRepoHeaders.map((repo) => ({
        repo,
        items: tagsByRepo[repo.repoId] ?? [],
      })),
    [enabledRepoHeaders, tagsByRepo]
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

  const openTerminalAtPath = useCallback(
    async (title: string, path: string) => {
      try {
        const next = await createPaneNode({
          cwd: path,
          meta: {
            title,
            subtitle: path,
            cwd: path,
          },
        });
        appendPane(next, title);
      } catch (error) {
        console.warn("Failed to open terminal pane", error);
      }
    },
    [appendPane]
  );

  const handleOpenRepoTerminal = useCallback(
    (repo: RepoHeader) => {
      void openTerminalAtPath(repo.name, repo.path);
    },
    [openTerminalAtPath]
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

  const handleOpenRepoAgent = useCallback(
    async (repo: RepoHeader) => {
      try {
        const next = await createAgentPaneNode({
          agentId: "Claude Code",
          cwd: repo.path,
          meta: {
            title: repo.name,
            subtitle: repo.path,
            cwd: repo.path,
          },
        });
        appendPane(next, next.meta?.title ?? "Agent");
      } catch (error) {
        console.warn("Failed to open agent pane", error);
      }
    },
    [appendPane]
  );

  const handleOpenWorktreeTerminal = useCallback(
    (repo: RepoHeader, worktree: WorktreeItem) => {
      const title = `${repo.name}:${worktree.branch}`;
      void openTerminalAtPath(title, worktree.path);
    },
    [openTerminalAtPath]
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

  const handleOpenWorktreeAgent = useCallback(
    async (_repo: RepoHeader, worktree: WorktreeItem) => {
      try {
        const next = await createAgentPaneNode({
          agentId: "Claude Code",
          cwd: worktree.path,
          meta: {
            title: `${_repo.name}:${worktree.branch}`,
            subtitle: worktree.path,
            cwd: worktree.path,
          },
        });
        appendPane(next, next.meta?.title ?? "Agent");
      } catch (error) {
        console.warn("Failed to open agent pane", error);
      }
    },
    [appendPane]
  );

  const handleRebaseBranch = useCallback(
    (repoId: string, targetBranch: string, ontoBranch: string) => {
      if (onRebaseBranch) {
        onRebaseBranch(repoId, targetBranch, ontoBranch);
        return;
      }

      void runGitCommand("Rebase failed", "Failed to rebase branch.", () =>
        rebaseBranch(repoId, targetBranch, ontoBranch)
      );
    },
    [onRebaseBranch, runGitCommand, rebaseBranch]
  );

  const handleSwitchBranch = useCallback(
    (repoId: string, branchName: string) => {
      const status = statusByRepo[repoId];
      if (status && (status.has_staged || status.has_unstaged)) {
        if (onSwitchBranchWithCheck) {
          onSwitchBranchWithCheck(repoId, branchName);
        }
        return;
      }
      void runGitCommand("Switch branch failed", "Failed to switch branch.", () =>
        switchBranch(repoId, branchName)
      );
    },
    [statusByRepo, onSwitchBranchWithCheck, runGitCommand, switchBranch]
  );

  const handleSquashCommits = useCallback(
    (repoId: string, worktreePath: string, commitIds: string[]) => {
      void runGitCommand("Squash failed", "Failed to squash commits.", async () => {
        const alreadyInRemote = await commitsInRemote(repoId, commitIds, worktreePath);
        if (alreadyInRemote) {
          if (onSquashCommitsWithCheck) {
            onSquashCommitsWithCheck(repoId, worktreePath, commitIds);
          }
          return;
        }
        await squashCommits(repoId, commitIds, worktreePath);
      });
    },
    [runGitCommand, commitsInRemote, onSquashCommitsWithCheck, squashCommits]
  );

  const handleSmartUpdateWorktrees = useCallback(
    (repoId: string) => {
      void runGitCommand(
        "Smart update failed",
        "Failed to smart update worktrees.",
        () => smartUpdateWorktrees(repoId)
      );
    },
    [runGitCommand, smartUpdateWorktrees]
  );

  return (
    <GitPanel
      width={width}
      loading={gitLoading}
      error={gitError}
      repos={repoHeaders}
      enabledRepoIds={enabledRepoIds}
      onEnableRepos={setEnabledRepoIds}
      branchGroups={branchGroups}
      commitGroups={commitGroups}
      worktreeGroups={worktreeGroups}
      worktreeCommitsByRepo={worktreeUniqueCommitsByRepo}
      isLoadingWorktreeCommits={isLoadingWorktreeCommits}
      remoteGroups={remoteGroups}
      submoduleGroups={submoduleGroups}
      stashGroups={stashGroups}
      tagGroups={tagGroups}
      onLoadMoreTags={loadMoreTags}
      canLoadMoreTags={canLoadMoreTags}
      isLoadingMoreTags={isLoadingMoreTags}
      changedFileGroups={changedFileGroups}
      onRemoveRepo={onRemoveRepo}
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
        void runGitCommand("Pull failed", "Failed to pull changes.", () => pull(repoId));
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
      onSwitchBranch={handleSwitchBranch}
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
      onSquashCommits={handleSquashCommits}
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
      onStash={(repoId, message) => {
        void runGitCommand("Stash failed", "Failed to stash changes.", () =>
          createStash(repoId, message)
        );
      }}
      onDeleteStash={(repoId, stashIndex) => {
        void runGitCommand("Delete stash failed", "Failed to delete stash.", () =>
          dropStash(repoId, stashIndex)
        );
      }}
      onOpenRepoTerminal={handleOpenRepoTerminal}
      onOpenRepoFolder={handleOpenRepoFolder}
      onOpenRepoAgent={handleOpenRepoAgent}
      onOpenWorktreeTerminal={handleOpenWorktreeTerminal}
      onOpenWorktreeFolder={handleOpenWorktreeFolder}
      onOpenWorktreeAgent={handleOpenWorktreeAgent}
      onSmartUpdateWorktrees={handleSmartUpdateWorktrees}
      onOpenFolder={onTriggerOpenFolder}
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
  );
}
