import { useCallback, useMemo, useRef, useState } from "react";
import {
  gitAddWorktree,
  gitCheckoutBranch,
  gitCommit,
  gitCommitsInRemote,
  gitCreateBranch,
  gitDeleteBranch,
  gitDiscardFiles,
  gitListBranches,
  gitListCommits,
  gitListRemoteBranches,
  gitListRemotes,
  gitListSubmodules,
  gitListStashes,
  gitListWorktrees,
  gitPull,
  gitPush,
  gitRemoveWorktree,
  gitReset,
  gitRevert,
  gitSquashCommits,
  gitSmartCheckoutBranch,
  gitStageAll,
  gitStageFiles,
  gitStatus,
  gitUnstageAll,
  gitUnstageFiles,
} from "../../services/tauri";
import { formatInvokeError } from "../../services/errors";
import type {
  BranchInfoDto,
  CommitInfoDto,
  FileStatusDto,
  RemoteInfoDto,
  RepoInfoDto,
  RepoStatusDto,
  StashInfoDto,
  SubmoduleInfoDto,
  WorktreeInfoDto,
} from "../../types/git";
import type {
  BranchItem,
  ChangedFile,
  CommitItem,
  RemoteItem,
  StashItem,
  SubmoduleItem,
  WorktreeItem,
} from "../../types/git-ui";


function mapFileStatus(file: FileStatusDto): ChangedFile[] {
  const entries: ChangedFile[] = [];
  if (file.staged) {
    entries.push({
      path: file.path,
      status: mapChangeType(file.staged),
      staged: true,
      insertions: file.staged_stats?.insertions,
      deletions: file.staged_stats?.deletions,
    });
  }
  if (file.unstaged) {
    entries.push({
      path: file.path,
      status: mapChangeType(file.unstaged),
      staged: false,
      insertions: file.unstaged_stats?.insertions,
      deletions: file.unstaged_stats?.deletions,
    });
  }
  return entries;
}

function mapChangeType(
  status: "added" | "modified" | "deleted" | "renamed" | "unmerged"
): ChangedFile["status"] {
  if (status === "added") return "added";
  if (status === "deleted") return "deleted";
  return "modified";
}

function mapBranches(branches: BranchInfoDto[]): BranchItem[] {
  return branches.map((branch) => ({
    name: branch.name,
    current: branch.current,
    lastCommit: branch.last_commit || "",
    ahead: branch.ahead,
    behind: branch.behind,
  }));
}

function mapCommits(commits: CommitInfoDto[]): CommitItem[] {
  return commits.map((commit) => ({
    id: commit.id.slice(0, 7),
    message: commit.summary,
    author: commit.author,
    date: commit.relative_time,
  }));
}

function mapWorktrees(worktrees: WorktreeInfoDto[]): WorktreeItem[] {
  return worktrees.map((worktree) => ({
    branch: worktree.branch,
    path: worktree.path,
  }));
}

function mapRemotes(remotes: RemoteInfoDto[]): RemoteItem[] {
  return remotes.map((remote) => ({
    name: remote.name,
    fetch: remote.fetch,
    push: remote.push,
  }));
}

function mapSubmodules(submodules: SubmoduleInfoDto[]): SubmoduleItem[] {
  return submodules.map((submodule) => ({
    name: submodule.name,
    path: submodule.path,
    url: submodule.url ?? null,
  }));
}

function mapStashes(stashes: StashInfoDto[]): StashItem[] {
  return stashes.map((stash) => ({
    index: stash.index,
    message: stash.message,
    id: stash.id,
    relativeTime: stash.relative_time,
  }));
}

type RepoId = string;
type WithRepoOptions = {
  refresh?: boolean;
  errorMessage?: string;
};

export function useGitRepos() {
  const refreshSeqRef = useRef(0);
  const loadMoreSeqRef = useRef<Record<RepoId, number>>({});
  const [repos, setReposState] = useState<RepoInfoDto[]>([]);
  const [statusByRepo, setStatusByRepo] = useState<Record<RepoId, RepoStatusDto | null>>({});
  
  // Store ALL fetched data
  const [allLocalBranchesByRepo, setAllLocalBranchesByRepo] = useState<Record<RepoId, BranchItem[]>>({});
  const [allRemoteBranchesByRepo, setAllRemoteBranchesByRepo] = useState<Record<RepoId, BranchItem[]>>({});
  
  const [commitsByRepo, setCommitsByRepo] = useState<Record<RepoId, CommitItem[]>>({});
  const [worktreesByRepo, setWorktreesByRepo] = useState<Record<RepoId, WorktreeItem[]>>({});
  const [remotesByRepo, setRemotesByRepo] = useState<Record<RepoId, RemoteItem[]>>({});
  const [submodulesByRepo, setSubmodulesByRepo] = useState<Record<RepoId, SubmoduleItem[]>>({});
  const [stashesByRepo, setStashesByRepo] = useState<Record<RepoId, StashItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [commitsSkipByRepo, setCommitsSkipByRepo] = useState<Record<RepoId, number>>({});
  const [hasMoreCommitsByRepo, setHasMoreCommitsByRepo] = useState<Record<RepoId, boolean>>({});
  const [loadingMoreCommitsByRepo, setLoadingMoreCommitsByRepo] = useState<Record<RepoId, boolean>>({});
  
  const [localBranchLimitByRepo, setLocalBranchLimitByRepo] = useState<Record<RepoId, number>>({});
  const [remoteBranchLimitByRepo, setRemoteBranchLimitByRepo] = useState<Record<RepoId, number>>({});

  const setRepos = useCallback((nextRepos: RepoInfoDto[]) => {
    setReposState(nextRepos);
    
    // Cleanup removed repos from state
    const allowed = new Set(nextRepos.map((repo) => repo.repo_id));
    const filterState = <T>(prev: Record<RepoId, T>) => 
      Object.fromEntries(Object.entries(prev).filter(([key]) => allowed.has(key)));

    setStatusByRepo(filterState);
    setAllLocalBranchesByRepo(filterState);
    setAllRemoteBranchesByRepo(filterState);
    setCommitsByRepo(filterState);
    setWorktreesByRepo(filterState);
    setRemotesByRepo(filterState);
    setSubmodulesByRepo(filterState);
    setStashesByRepo(filterState);
    
    setCommitsSkipByRepo(filterState);
    setHasMoreCommitsByRepo(filterState);
    setLoadingMoreCommitsByRepo(filterState);
    setLocalBranchLimitByRepo(filterState);
    setRemoteBranchLimitByRepo(filterState);
  }, []);

  const refreshRepos = useCallback(
    async (repoId?: RepoId) => {
      const targets = repoId
        ? repos.filter((repo) => repo.repo_id === repoId)
        : repos;
      if (!targets.length) return;
      const requestId = ++refreshSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        // Reset pagination for targets
        setCommitsSkipByRepo((prev) => {
          const next = { ...prev };
          targets.forEach((r) => { next[r.repo_id] = 0; });
          return next;
        });
        setHasMoreCommitsByRepo((prev) => {
          const next = { ...prev };
          targets.forEach((r) => { next[r.repo_id] = true; });
          return next;
        });
        setLocalBranchLimitByRepo((prev) => {
          const next = { ...prev };
          targets.forEach((r) => { next[r.repo_id] = 10; });
          return next;
        });
        setRemoteBranchLimitByRepo((prev) => {
          const next = { ...prev };
          targets.forEach((r) => { next[r.repo_id] = 10; });
          return next;
        });

        const results = await Promise.all(
          targets.map(async (repo) => {
            const [
              statusDto,
              local,
              remote,
              commitDtos,
              worktreeDtos,
              remoteDtos,
              submoduleDtos,
              stashDtos,
            ] = await Promise.all([
              gitStatus({ cwd: repo.root_path }),
              gitListBranches({ cwd: repo.root_path }),
              gitListRemoteBranches({ cwd: repo.root_path }),
              gitListCommits({ cwd: repo.root_path, limit: 10, skip: 0 }),
              gitListWorktrees({ cwd: repo.root_path }),
              gitListRemotes({ cwd: repo.root_path }),
              gitListSubmodules({ cwd: repo.root_path }),
              gitListStashes({ cwd: repo.root_path }),
            ]);
            return {
              repoId: repo.repo_id,
              status: statusDto,
              localBranches: mapBranches(local),
              remoteBranches: mapBranches(remote),
              commits: mapCommits(commitDtos),
              hasMoreCommits: commitDtos.length === 10,
              worktrees: mapWorktrees(worktreeDtos),
              remotes: mapRemotes(remoteDtos),
              submodules: mapSubmodules(submoduleDtos),
              stashes: mapStashes(stashDtos),
            };
          })
        );

        if (requestId !== refreshSeqRef.current) {
          return;
        }

        setStatusByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.status;
          return next;
        });
        setAllLocalBranchesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.localBranches;
          return next;
        });
        setAllRemoteBranchesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.remoteBranches;
          return next;
        });
        setCommitsByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.commits;
          return next;
        });
        setHasMoreCommitsByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.hasMoreCommits;
          return next;
        });
        setWorktreesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.worktrees;
          return next;
        });
        setRemotesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.remotes;
          return next;
        });
        setSubmodulesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.submodules;
          return next;
        });
        setStashesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.stashes;
          return next;
        });
      } catch (err) {
        if (requestId !== refreshSeqRef.current) {
          return;
        }
        const message = formatInvokeError(err);
        setError(message === "Unexpected error." ? "Failed to load git data." : message);
      } finally {
        if (requestId === refreshSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [repos]
  );

  const loadMoreCommits = useCallback(async (repoId: RepoId) => {
    const repo = repos.find((r) => r.repo_id === repoId);
    if (!repo || !hasMoreCommitsByRepo[repoId] || loadingMoreCommitsByRepo[repoId]) return;

    const requestId = (loadMoreSeqRef.current[repoId] ?? 0) + 1;
    loadMoreSeqRef.current[repoId] = requestId;
    setLoadingMoreCommitsByRepo((prev) => ({ ...prev, [repoId]: true }));
    try {
      const skip = commitsSkipByRepo[repoId] ?? 0;
      const nextSkip = skip + 10;
      const moreCommits = await gitListCommits({
        cwd: repo.root_path,
        limit: 10,
        skip: nextSkip,
      });

      if (loadMoreSeqRef.current[repoId] !== requestId) {
        return;
      }

      setCommitsByRepo((prev) => ({
        ...prev,
        [repoId]: [...(prev[repoId] ?? []), ...mapCommits(moreCommits)],
      }));
      setCommitsSkipByRepo((prev) => ({ ...prev, [repoId]: nextSkip }));
      if (moreCommits.length < 10) {
        setHasMoreCommitsByRepo((prev) => ({ ...prev, [repoId]: false }));
      }
    } finally {
      if (loadMoreSeqRef.current[repoId] === requestId) {
        setLoadingMoreCommitsByRepo((prev) => ({ ...prev, [repoId]: false }));
      }
    }
  }, [repos, hasMoreCommitsByRepo, loadingMoreCommitsByRepo, commitsSkipByRepo]);

  const loadMoreLocalBranches = useCallback((repoId: RepoId) => {
    setLocalBranchLimitByRepo((prev) => ({ ...prev, [repoId]: (prev[repoId] ?? 10) + 10 }));
  }, []);

  const loadMoreRemoteBranches = useCallback((repoId: RepoId) => {
    setRemoteBranchLimitByRepo((prev) => ({ ...prev, [repoId]: (prev[repoId] ?? 10) + 10 }));
  }, []);

  const changedFilesByRepo = useMemo(() => {
    return Object.fromEntries(
      Object.entries(statusByRepo).map(([repoId, status]) => [
        repoId,
        status ? status.modified_files.flatMap(mapFileStatus) : [],
      ])
    );
  }, [statusByRepo]);

  // Derived sliced branches
  const localBranchesByRepo = useMemo(() => {
    return Object.fromEntries(
      Object.entries(allLocalBranchesByRepo).map(([repoId, branches]) => [
        repoId,
        branches.slice(0, localBranchLimitByRepo[repoId] ?? 10),
      ])
    );
  }, [allLocalBranchesByRepo, localBranchLimitByRepo]);

  const remoteBranchesByRepo = useMemo(() => {
    return Object.fromEntries(
      Object.entries(allRemoteBranchesByRepo).map(([repoId, branches]) => [
        repoId,
        branches.slice(0, remoteBranchLimitByRepo[repoId] ?? 10),
      ])
    );
  }, [allRemoteBranchesByRepo, remoteBranchLimitByRepo]);

  const resolveRepo = useCallback(
    (repoId: RepoId) => {
      const repo = repos.find((entry) => entry.repo_id === repoId) ?? null;
      return repo;
    },
    [repos]
  );

  const withRepo = useCallback(
    async function <T>(
      repoId: RepoId,
      task: (repo: RepoInfoDto) => Promise<T>,
      options: WithRepoOptions = {}
    ) {
      const repo = resolveRepo(repoId);
      if (!repo) return;

      const { refresh = true, errorMessage } = options;

      try {
        const result = await task(repo);
        if (refresh) {
          await refreshRepos(repo.repo_id);
        }
        return result;
      } catch (err) {
        if (errorMessage) {
          console.error(errorMessage, err);
        }
        throw err;
      }
    },
    [refreshRepos, resolveRepo]
  );

  const stageFiles = useCallback(
    async (repoId: RepoId, paths: string[]) => {
      if (!paths.length) return;
      await withRepo(repoId, (repo) => gitStageFiles({ cwd: repo.root_path, paths }));
    },
    [withRepo]
  );

  const unstageFiles = useCallback(
    async (repoId: RepoId, paths: string[]) => {
      if (!paths.length) return;
      await withRepo(repoId, (repo) => gitUnstageFiles({ cwd: repo.root_path, paths }));
    },
    [withRepo]
  );

  const discardFiles = useCallback(
    async (repoId: RepoId, paths: string[]) => {
      if (!paths.length) return;
      await withRepo(repoId, (repo) => gitDiscardFiles({ cwd: repo.root_path, paths }));
    },
    [withRepo]
  );

  const stageAll = useCallback(
    async (repoId: RepoId) => {
      await withRepo(repoId, (repo) => gitStageAll({ cwd: repo.root_path }));
    },
    [withRepo]
  );

  const unstageAll = useCallback(
    async (repoId: RepoId) => {
      await withRepo(repoId, (repo) => gitUnstageAll({ cwd: repo.root_path }));
    },
    [withRepo]
  );

  const commit = useCallback(
    async (repoId: RepoId, message: string) => {
      await withRepo(repoId, (repo) =>
        gitCommit({ cwd: repo.root_path, message, stageAll: false, amend: false })
      );
    },
    [withRepo]
  );

  const pull = useCallback(
    async (repoId: RepoId) => {
      await withRepo(repoId, (repo) => gitPull({ cwd: repo.root_path }));
    },
    [withRepo]
  );

  const push = useCallback(
    async (repoId: RepoId, force: boolean) => {
      await withRepo(repoId, (repo) => gitPush({ cwd: repo.root_path, force }));
    },
    [withRepo]
  );

  const createBranch = useCallback(
    async (repoId: RepoId, name: string, sourceBranch?: string) => {
      await withRepo(
        repoId,
        (repo) =>
          gitCreateBranch({
            cwd: repo.root_path,
            branchName: name,
            sourceBranch,
          }),
        { errorMessage: "Failed to create branch" }
      );
    },
    [withRepo]
  );

  const deleteBranch = useCallback(
    async (repoId: RepoId, branchName: string) => {
      await withRepo(
        repoId,
        (repo) =>
          gitDeleteBranch({
            repoRoot: repo.root_path,
            branch: branchName,
            force: false,
          }),
        { errorMessage: "Failed to delete branch" }
      );
    },
    [withRepo]
  );

  const switchBranch = useCallback(
    async (repoId: RepoId, branchName: string) => {
      await withRepo(
        repoId,
        (repo) =>
          gitCheckoutBranch({
            cwd: repo.root_path,
            branchName,
          }),
        { errorMessage: "Failed to switch branch" }
      );
    },
    [withRepo]
  );

  const smartSwitchBranch = useCallback(
    async (repoId: RepoId, branchName: string) => {
      await withRepo(
        repoId,
        (repo) =>
          gitSmartCheckoutBranch({
            cwd: repo.root_path,
            branchName,
          }),
        { errorMessage: "Failed to smart switch branch" }
      );
    },
    [withRepo]
  );

  const reset = useCallback(
    async (repoId: RepoId, target: string, mode: "soft" | "mixed" | "hard") => {
      await withRepo(
        repoId,
        (repo) =>
          gitReset({
            cwd: repo.root_path,
            target,
            mode,
          }),
        { errorMessage: "Failed to reset" }
      );
    },
    [withRepo]
  );

  const revert = useCallback(
    async (repoId: RepoId, commitId: string) => {
      await withRepo(
        repoId,
        (repo) =>
          gitRevert({
            cwd: repo.root_path,
            commit: commitId,
          }),
        { errorMessage: "Failed to revert commit" }
      );
    },
    [withRepo]
  );

  const squashCommits = useCallback(
    async (repoId: RepoId, commitIds: string[]) => {
      await withRepo(
        repoId,
        (repo) =>
          gitSquashCommits({
            cwd: repo.root_path,
            commits: commitIds,
          }),
        { errorMessage: "Failed to squash commits" }
      );
    },
    [withRepo]
  );

  const commitsInRemote = useCallback(
    async (repoId: RepoId, commitIds: string[]) => {
      const result = await withRepo(
        repoId,
        (repo) =>
          gitCommitsInRemote({
            cwd: repo.root_path,
            commits: commitIds,
          }),
        { refresh: false, errorMessage: "Failed to check commits in remote" }
      );
      return result ?? false;
    },
    [withRepo]
  );

  const createWorktree = useCallback(
    async (repoId: RepoId, branchName: string, path: string) => {
      await withRepo(
        repoId,
        (repo) =>
          gitAddWorktree({
            repoRoot: repo.root_path,
            path,
            branch: branchName,
            startPoint: "HEAD",
          }),
        { errorMessage: "Failed to create worktree" }
      );
    },
    [withRepo]
  );

  const removeWorktree = useCallback(
    async (repoId: RepoId, branchName: string) => {
      await withRepo(
        repoId,
        async (repo) => {
          const worktrees = worktreesByRepo[repoId] || [];
          const worktree = worktrees.find((wt) => wt.branch === branchName);

          if (!worktree) {
            console.error("Worktree not found for branch", branchName);
            return;
          }

          // Force removal to ensure cleanup
          await gitRemoveWorktree({
            repoRoot: repo.root_path,
            path: worktree.path,
            force: true,
          });

          // Also delete the branch
          await gitDeleteBranch({
            repoRoot: repo.root_path,
            branch: branchName,
            force: true,
          });
        },
        { errorMessage: "Failed to remove worktree" }
      );
    },
    [withRepo, worktreesByRepo]
  );

  return {
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
    loading,
    error,
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
    loadMoreCommits,
    loadMoreLocalBranches,
    loadMoreRemoteBranches,
    canLoadMoreCommits: useCallback((repoId: string) => hasMoreCommitsByRepo[repoId] ?? false, [hasMoreCommitsByRepo]),
    canLoadMoreLocalBranches: useCallback((repoId: string) => (allLocalBranchesByRepo[repoId]?.length ?? 0) > (localBranchLimitByRepo[repoId] ?? 10), [allLocalBranchesByRepo, localBranchLimitByRepo]),
    canLoadMoreRemoteBranches: useCallback((repoId: string) => (allRemoteBranchesByRepo[repoId]?.length ?? 0) > (remoteBranchLimitByRepo[repoId] ?? 10), [allRemoteBranchesByRepo, remoteBranchLimitByRepo]),
    isLoadingMoreCommits: useCallback((repoId: string) => loadingMoreCommitsByRepo[repoId] ?? false, [loadingMoreCommitsByRepo]),
  };
}
