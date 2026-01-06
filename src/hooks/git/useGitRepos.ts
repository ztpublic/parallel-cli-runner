import { useCallback, useRef, useState } from "react";
import {
  gitAddWorktree,
  gitApplyStash,
  gitCheckoutBranch,
  gitCommit,
  gitCommitsInRemote,
  gitCreateBranch,
  gitDeleteBranch,
  gitDetachWorktreeHead,
  gitDropStash,
  gitDiscardFiles,
  gitListBranches,
  gitListCommits,
  gitListRemoteBranches,
  gitListRemotes,
  gitListSubmodules,
  gitListStashes,
  gitListTags,
  gitListWorktrees,
  gitMergeIntoBranch,
  gitRebaseBranch,
  gitPull,
  gitPush,
  gitRemoveWorktree,
  gitReset,
  gitRevert,
  gitSquashCommits,
  gitSmartCheckoutBranch,
  gitStageAll,
  gitStageFiles,
  gitStashSave,
  gitStatus,
  gitUnstageAll,
  gitUnstageFiles,
} from "../../services/backend";
import { formatInvokeError } from "../../services/errors";
import type {
  BranchInfoDto,
  RemoteInfoDto,
  RepoInfoDto,
  StashInfoDto,
  SubmoduleInfoDto,
  TagInfoDto,
  WorktreeInfoDto,
} from "../../types/git";
import type {
  BranchItem,
  RemoteItem,
  StashItem,
  SubmoduleItem,
  TagItem,
  WorktreeItem,
} from "../../types/git-ui";
import { parseWorktreeTargetId } from "./gitTargets";
import { useGitBranches } from "./useGitBranches";
import { mapCommits, useGitCommits } from "./useGitCommits";
import { useGitDiff } from "./useGitDiff";
import { useGitRepoMetadata } from "./useGitRepoMetadata";
import { useGitStatus } from "./useGitStatus";
import { useGitWorktrees } from "./useGitWorktrees";

function mapBranches(branches: BranchInfoDto[]): BranchItem[] {
  return branches.map((branch) => ({
    name: branch.name,
    current: branch.current,
    lastCommit: branch.last_commit || "",
    ahead: branch.ahead,
    behind: branch.behind,
  }));
}

function mapWorktrees(worktrees: WorktreeInfoDto[]): WorktreeItem[] {
  return worktrees.map((worktree) => ({
    branch: worktree.branch,
    path: worktree.path,
    ahead: worktree.ahead,
    behind: worktree.behind,
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

function mapTags(tags: TagInfoDto[]): TagItem[] {
  return tags.map((tag) => ({
    name: tag.name,
  }));
}

type RepoId = string;
type WithRepoOptions = {
  refresh?: boolean;
  errorMessage?: string;
};

const TAGS_PAGE_SIZE = 25;

export function useGitRepos() {
  const refreshSeqRef = useRef(0);
  const loadMoreTagsSeqRef = useRef<Record<RepoId, number>>({});
  const [repos, setReposState] = useState<RepoInfoDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { statusByRepo, setStatusByRepo, statusByWorktreeByRepo, setStatusByWorktreeByRepo } =
    useGitStatus();
  const { changedFilesByRepo, changedFilesByWorktreeByRepo } = useGitDiff({
    statusByRepo,
    statusByWorktreeByRepo,
  });
  const {
    allLocalBranchesByRepo: _allLocalBranchesByRepo,
    setAllLocalBranchesByRepo,
    allRemoteBranchesByRepo: _allRemoteBranchesByRepo,
    setAllRemoteBranchesByRepo,
    localBranchLimitByRepo: _localBranchLimitByRepo,
    setLocalBranchLimitByRepo,
    remoteBranchLimitByRepo: _remoteBranchLimitByRepo,
    setRemoteBranchLimitByRepo,
    localBranchesByRepo,
    remoteBranchesByRepo,
    loadMoreLocalBranches,
    loadMoreRemoteBranches,
    canLoadMoreLocalBranches,
    canLoadMoreRemoteBranches,
  } = useGitBranches();
  const {
    worktreesByRepo,
    setWorktreesByRepo,
    commitsByRepo: worktreeUniqueCommitsByRepo,
    fetchWorktreeCommits,
    isLoadingWorktreeCommits,
    getWorktreeCommits,
  } = useGitWorktrees();
  const {
    remotesByRepo,
    setRemotesByRepo,
    submodulesByRepo,
    setSubmodulesByRepo,
    stashesByRepo,
    setStashesByRepo,
    tagsByRepo,
    setTagsByRepo,
  } = useGitRepoMetadata();
  const [tagsSkipByRepo, setTagsSkipByRepo] = useState<Record<RepoId, number>>({});
  const [hasMoreTagsByRepo, setHasMoreTagsByRepo] = useState<Record<RepoId, boolean>>({});
  const [loadingMoreTagsByRepo, setLoadingMoreTagsByRepo] = useState<Record<RepoId, boolean>>({});
  const {
    worktreeCommitsByRepo,
    setWorktreeCommitsByRepo,
    commitsSkipByWorktreeByRepo: _commitsSkipByWorktreeByRepo,
    setCommitsSkipByWorktreeByRepo,
    hasMoreCommitsByWorktreeByRepo: _hasMoreCommitsByWorktreeByRepo,
    setHasMoreCommitsByWorktreeByRepo,
    loadingMoreCommitsByWorktreeByRepo: _loadingMoreCommitsByWorktreeByRepo,
    setLoadingMoreCommitsByWorktreeByRepo,
    loadMoreCommits,
    canLoadMoreCommits,
    isLoadingMoreCommits,
  } = useGitCommits(worktreesByRepo);

  const setRepos = useCallback((nextRepos: RepoInfoDto[]) => {
    setReposState(nextRepos);
    
    // Cleanup removed repos from state
    const allowed = new Set(nextRepos.map((repo) => repo.repo_id));
    const filterState = <T>(prev: Record<RepoId, T>) => 
      Object.fromEntries(Object.entries(prev).filter(([key]) => allowed.has(key)));

    setStatusByRepo(filterState);
    setStatusByWorktreeByRepo(filterState);
    setAllLocalBranchesByRepo(filterState);
    setAllRemoteBranchesByRepo(filterState);
    setWorktreeCommitsByRepo(filterState);
    setWorktreesByRepo(filterState);
    setRemotesByRepo(filterState);
    setSubmodulesByRepo(filterState);
    setStashesByRepo(filterState);
    setTagsByRepo(filterState);
    setTagsSkipByRepo(filterState);
    setHasMoreTagsByRepo(filterState);
    setLoadingMoreTagsByRepo(filterState);
    
    setCommitsSkipByWorktreeByRepo(filterState);
    setHasMoreCommitsByWorktreeByRepo(filterState);
    setLoadingMoreCommitsByWorktreeByRepo(filterState);
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
        setTagsSkipByRepo((prev) => {
          const next = { ...prev };
          targets.forEach((r) => {
            next[r.repo_id] = 0;
          });
          return next;
        });

        const results = await Promise.all(
          targets.map(async (repo) => {
            const [
              statusDto,
              local,
              remote,
              worktreeDtos,
              remoteDtos,
              submoduleDtos,
              stashDtos,
              tagDtos,
            ] = await Promise.all([
              gitStatus({ cwd: repo.root_path }),
              gitListBranches({ cwd: repo.root_path }),
              gitListRemoteBranches({ cwd: repo.root_path }),
              gitListWorktrees({ cwd: repo.root_path }),
              gitListRemotes({ cwd: repo.root_path }),
              gitListSubmodules({ cwd: repo.root_path }),
              gitListStashes({ cwd: repo.root_path }),
              gitListTags({ cwd: repo.root_path, limit: TAGS_PAGE_SIZE, skip: 0 }),
            ]);
            const worktrees = mapWorktrees(worktreeDtos);
            const resolvedWorktrees =
              worktrees.length > 0
                ? worktrees
                : [{ branch: statusDto.branch || "HEAD", path: repo.root_path }];
            const worktreeStatusDtos = await Promise.all(
              resolvedWorktrees.map((worktree) =>
                worktree.path === repo.root_path
                  ? Promise.resolve(statusDto)
                  : gitStatus({ cwd: worktree.path })
              )
            );
            const worktreeStatuses = Object.fromEntries(
              resolvedWorktrees.map((worktree, index) => [
                worktree.path,
                worktreeStatusDtos[index] ?? null,
              ])
            );
            const worktreeCommitDtos = await Promise.all(
              resolvedWorktrees.map((worktree) =>
                gitListCommits({ cwd: worktree.path, limit: 10, skip: 0 })
              )
            );
            const worktreeCommits = Object.fromEntries(
              resolvedWorktrees.map((worktree, index) => [
                worktree.path,
                mapCommits(worktreeCommitDtos[index] ?? []),
              ])
            );
            const worktreeSkips = Object.fromEntries(
              resolvedWorktrees.map((worktree) => [worktree.path, 0])
            );
            const hasMoreCommitsByWorktree = Object.fromEntries(
              resolvedWorktrees.map((worktree, index) => [
                worktree.path,
                (worktreeCommitDtos[index] ?? []).length === 10,
              ])
            );
            const loadingMoreCommitsByWorktree = Object.fromEntries(
              resolvedWorktrees.map((worktree) => [worktree.path, false])
            );
            return {
              repoId: repo.repo_id,
              status: statusDto,
              localBranches: mapBranches(local),
              remoteBranches: mapBranches(remote),
              worktrees: resolvedWorktrees,
              worktreeStatuses,
              worktreeCommits,
              worktreeSkips,
              hasMoreCommitsByWorktree,
              loadingMoreCommitsByWorktree,
              remotes: mapRemotes(remoteDtos),
              submodules: mapSubmodules(submoduleDtos),
              stashes: mapStashes(stashDtos),
              tags: mapTags(tagDtos),
              tagsSkip: 0,
              hasMoreTags: tagDtos.length === TAGS_PAGE_SIZE,
              loadingMoreTags: false,
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
        setStatusByWorktreeByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.worktreeStatuses;
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
        setWorktreeCommitsByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.worktreeCommits;
          return next;
        });
        setCommitsSkipByWorktreeByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.worktreeSkips;
          return next;
        });
        setHasMoreCommitsByWorktreeByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.hasMoreCommitsByWorktree;
          return next;
        });
        setLoadingMoreCommitsByWorktreeByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.loadingMoreCommitsByWorktree;
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
        setTagsByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.tags;
          return next;
        });
        setTagsSkipByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.tagsSkip;
          return next;
        });
        setHasMoreTagsByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.hasMoreTags;
          return next;
        });
        setLoadingMoreTagsByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) next[result.repoId] = result.loadingMoreTags;
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

  const resolveRepo = useCallback(
    (repoId: RepoId) => {
      const repo = repos.find((entry) => entry.repo_id === repoId) ?? null;
      return repo;
    },
    [repos]
  );

  const resolveTarget = useCallback(
    (targetId: RepoId) => {
      const worktreeTarget = parseWorktreeTargetId(targetId);
      if (worktreeTarget) {
        const repo = resolveRepo(worktreeTarget.repoId);
        if (!repo) return null;
        return { repo, cwd: worktreeTarget.worktreePath };
      }
      const repo = resolveRepo(targetId);
      if (!repo) return null;
      return { repo, cwd: repo.root_path };
    },
    [resolveRepo]
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
      const target = resolveTarget(repoId);
      if (!target) return;
      await withRepo(target.repo.repo_id, () =>
        gitStageFiles({ cwd: target.cwd, paths })
      );
    },
    [resolveTarget, withRepo]
  );

  const unstageFiles = useCallback(
    async (repoId: RepoId, paths: string[]) => {
      if (!paths.length) return;
      const target = resolveTarget(repoId);
      if (!target) return;
      await withRepo(target.repo.repo_id, () =>
        gitUnstageFiles({ cwd: target.cwd, paths })
      );
    },
    [resolveTarget, withRepo]
  );

  const discardFiles = useCallback(
    async (repoId: RepoId, paths: string[]) => {
      if (!paths.length) return;
      const target = resolveTarget(repoId);
      if (!target) return;
      await withRepo(target.repo.repo_id, () =>
        gitDiscardFiles({ cwd: target.cwd, paths })
      );
    },
    [resolveTarget, withRepo]
  );

  const stageAll = useCallback(
    async (repoId: RepoId) => {
      const target = resolveTarget(repoId);
      if (!target) return;
      await withRepo(target.repo.repo_id, () => gitStageAll({ cwd: target.cwd }));
    },
    [resolveTarget, withRepo]
  );

  const unstageAll = useCallback(
    async (repoId: RepoId) => {
      const target = resolveTarget(repoId);
      if (!target) return;
      await withRepo(target.repo.repo_id, () =>
        gitUnstageAll({ cwd: target.cwd })
      );
    },
    [resolveTarget, withRepo]
  );

  const commit = useCallback(
    async (repoId: RepoId, message: string) => {
      const target = resolveTarget(repoId);
      if (!target) return;
      await withRepo(target.repo.repo_id, () =>
        gitCommit({ cwd: target.cwd, message, stageAll: false, amend: false })
      );
    },
    [resolveTarget, withRepo]
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

  const mergeIntoBranch = useCallback(
    async (repoId: RepoId, targetBranch: string, sourceBranch: string) => {
      await withRepo(
        repoId,
        (repo) =>
          gitMergeIntoBranch({
            repoRoot: repo.root_path,
            targetBranch,
            sourceBranch,
          }),
        { errorMessage: "Failed to merge branch" }
      );
    },
    [withRepo]
  );

  const rebaseBranch = useCallback(
    async (repoId: RepoId, targetBranch: string, ontoBranch: string) => {
      const target = resolveTarget(repoId);
      if (!target) return;
      await withRepo(
        target.repo.repo_id,
        () =>
          gitRebaseBranch({
            repoRoot: target.cwd,
            targetBranch,
            ontoBranch,
          }),
        { errorMessage: "Failed to rebase branch" }
      );
    },
    [resolveTarget, withRepo]
  );

  const smartUpdateWorktrees = useCallback(
    async (repoId: RepoId) => {
      const repo = resolveRepo(repoId);
      if (!repo) return;
      const activeBranch = statusByRepo[repoId]?.branch;
      if (!activeBranch) {
        throw new Error("Active branch not found for repository.");
      }

      const worktreeDtos = await gitListWorktrees({ cwd: repo.root_path });
      const worktrees = mapWorktrees(worktreeDtos).filter(
        (worktree) => worktree.path !== repo.root_path
      );
      if (!worktrees.length) return;

      const detachedWorktree = worktrees.find((worktree) => worktree.branch === "HEAD");
      if (detachedWorktree) {
        throw new Error(
          `Worktree at ${detachedWorktree.path} is detached (HEAD).`
        );
      }

      const behindWorktree = worktrees.find((worktree) => (worktree.behind ?? 0) > 0);
      if (behindWorktree) {
        throw new Error(
          `Worktree ${behindWorktree.branch} is behind ${activeBranch}.`
        );
      }

      // First pass: rebase each worktree onto active branch, then fast-forward active branch to each worktree
      for (const worktree of worktrees) {
        if (worktree.branch === activeBranch) continue;

        // Detach the worktree HEAD before rebasing
        await gitDetachWorktreeHead({ cwd: worktree.path });

        // Rebase the worktree branch onto active branch
        await gitRebaseBranch({
          repoRoot: repo.root_path,
          targetBranch: worktree.branch,
          ontoBranch: activeBranch,
        });

        // Fast-forward the active branch to the rebased worktree branch
        await gitRebaseBranch({
          repoRoot: repo.root_path,
          targetBranch: activeBranch,
          ontoBranch: worktree.branch,
        });

        // Checkout the branch back in the worktree
        await gitCheckoutBranch({
          cwd: worktree.path,
          branchName: worktree.branch,
        });
      }

      // Second pass: rebase each worktree onto the updated active branch
      for (const worktree of worktrees) {
        if (worktree.branch === activeBranch) continue;

        // Detach the worktree HEAD before rebasing
        await gitDetachWorktreeHead({ cwd: worktree.path });

        // Rebase the worktree branch onto active branch again
        await gitRebaseBranch({
          repoRoot: repo.root_path,
          targetBranch: worktree.branch,
          ontoBranch: activeBranch,
        });

        // Checkout the branch back in the worktree
        await gitCheckoutBranch({
          cwd: worktree.path,
          branchName: worktree.branch,
        });
      }

      await refreshRepos(repoId);
    },
    [refreshRepos, resolveRepo, statusByRepo]
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

  const checkoutBranchAtPath = useCallback(
    async (repoId: RepoId, worktreePath: string, branchName: string) => {
      await withRepo(
        repoId,
        () =>
          gitCheckoutBranch({
            cwd: worktreePath,
            branchName,
          }),
        { errorMessage: "Failed to check out branch in worktree" }
      );
    },
    [withRepo]
  );

  const detachWorktreeHead = useCallback(
    async (repoId: RepoId, worktreePath: string) => {
      await withRepo(
        repoId,
        () => gitDetachWorktreeHead({ cwd: worktreePath }),
        { refresh: false, errorMessage: "Failed to detach worktree HEAD" }
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
    async (
      repoId: RepoId,
      target: string,
      mode: "soft" | "mixed" | "hard",
      worktreePath?: string
    ) => {
      await withRepo(
        repoId,
        (repo) =>
          gitReset({
            cwd: worktreePath ?? repo.root_path,
            target,
            mode,
          }),
        { errorMessage: "Failed to reset" }
      );
    },
    [withRepo]
  );

  const revert = useCallback(
    async (repoId: RepoId, commitId: string, worktreePath?: string) => {
      await withRepo(
        repoId,
        (repo) =>
          gitRevert({
            cwd: worktreePath ?? repo.root_path,
            commit: commitId,
          }),
        { errorMessage: "Failed to revert commit" }
      );
    },
    [withRepo]
  );

  const squashCommits = useCallback(
    async (repoId: RepoId, commitIds: string[], worktreePath?: string) => {
      await withRepo(
        repoId,
        (repo) =>
          gitSquashCommits({
            cwd: worktreePath ?? repo.root_path,
            commits: commitIds,
          }),
        { errorMessage: "Failed to squash commits" }
      );
    },
    [withRepo]
  );

  const commitsInRemote = useCallback(
    async (repoId: RepoId, commitIds: string[], worktreePath?: string) => {
      const result = await withRepo(
        repoId,
        (repo) =>
          gitCommitsInRemote({
            cwd: worktreePath ?? repo.root_path,
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

  const applyStash = useCallback(
    async (repoId: RepoId, index: number) => {
      await withRepo(repoId, (repo) => gitApplyStash({ cwd: repo.root_path, index }));
    },
    [withRepo]
  );

  const dropStash = useCallback(
    async (repoId: RepoId, index: number) => {
      await withRepo(repoId, (repo) => gitDropStash({ cwd: repo.root_path, index }));
    },
    [withRepo]
  );

  const createStash = useCallback(
    async (repoId: RepoId, message?: string, includeUntracked: boolean = true) => {
      await withRepo(
        repoId,
        (repo) =>
          gitStashSave({
            cwd: repo.root_path,
            message,
            includeUntracked,
          }),
        { errorMessage: "Failed to stash changes" }
      );
    },
    [withRepo]
  );

  const loadMoreTags = useCallback(
    async (repoId: RepoId) => {
      const repo = resolveRepo(repoId);
      if (!repo) return;
      const hasMore = hasMoreTagsByRepo[repoId] ?? false;
      const isLoading = loadingMoreTagsByRepo[repoId] ?? false;
      if (!hasMore || isLoading) return;

      const requestId = (loadMoreTagsSeqRef.current[repoId] ?? 0) + 1;
      loadMoreTagsSeqRef.current = { ...loadMoreTagsSeqRef.current, [repoId]: requestId };
      setLoadingMoreTagsByRepo((prev) => ({ ...prev, [repoId]: true }));
      try {
        const skip = tagsSkipByRepo[repoId] ?? 0;
        const nextSkip = skip + TAGS_PAGE_SIZE;
        const moreTags = await gitListTags({
          cwd: repo.root_path,
          limit: TAGS_PAGE_SIZE,
          skip: nextSkip,
        });

        if ((loadMoreTagsSeqRef.current[repoId] ?? 0) !== requestId) return;

        setTagsByRepo((prev) => ({
          ...prev,
          [repoId]: [...(prev[repoId] ?? []), ...mapTags(moreTags)],
        }));
        setTagsSkipByRepo((prev) => ({ ...prev, [repoId]: nextSkip }));
        if (moreTags.length < TAGS_PAGE_SIZE) {
          setHasMoreTagsByRepo((prev) => ({ ...prev, [repoId]: false }));
        }
      } finally {
        if ((loadMoreTagsSeqRef.current[repoId] ?? 0) === requestId) {
          setLoadingMoreTagsByRepo((prev) => ({ ...prev, [repoId]: false }));
        }
      }
    },
    [hasMoreTagsByRepo, loadingMoreTagsByRepo, resolveRepo, tagsSkipByRepo]
  );

  const canLoadMoreTags = useCallback(
    (repoId: string) => hasMoreTagsByRepo[repoId] ?? false,
    [hasMoreTagsByRepo]
  );

  const isLoadingMoreTags = useCallback(
    (repoId: string) => loadingMoreTagsByRepo[repoId] ?? false,
    [loadingMoreTagsByRepo]
  );

  return {
    repos,
    setRepos,
    statusByRepo,
    statusByWorktreeByRepo,
    localBranchesByRepo,
    remoteBranchesByRepo,
    worktreeCommitsByRepo,
    worktreesByRepo,
    worktreeUniqueCommitsByRepo,
    fetchWorktreeCommits,
    isLoadingWorktreeCommits,
    getWorktreeCommits,
    remotesByRepo,
    submodulesByRepo,
    stashesByRepo,
    tagsByRepo,
    tagsSkipByRepo,
    hasMoreTagsByRepo,
    loadingMoreTagsByRepo,
    changedFilesByRepo,
    changedFilesByWorktreeByRepo,
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
    mergeIntoBranch,
    rebaseBranch,
    smartUpdateWorktrees,
    createBranch,
    deleteBranch,
    switchBranch,
    checkoutBranchAtPath,
    detachWorktreeHead,
    smartSwitchBranch,
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
  };
}
