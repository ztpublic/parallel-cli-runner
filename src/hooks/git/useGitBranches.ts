import { useCallback, useMemo, useState } from "react";
import type { BranchItem } from "../../types/git-ui";

type RepoId = string;

export function useGitBranches() {
  const [allLocalBranchesByRepo, setAllLocalBranchesByRepo] = useState<Record<RepoId, BranchItem[]>>({});
  const [allRemoteBranchesByRepo, setAllRemoteBranchesByRepo] = useState<Record<RepoId, BranchItem[]>>({});
  const [localBranchLimitByRepo, setLocalBranchLimitByRepo] = useState<Record<RepoId, number>>({});
  const [remoteBranchLimitByRepo, setRemoteBranchLimitByRepo] = useState<Record<RepoId, number>>({});

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

  const loadMoreLocalBranches = useCallback((repoId: RepoId) => {
    setLocalBranchLimitByRepo((prev) => ({ ...prev, [repoId]: (prev[repoId] ?? 10) + 10 }));
  }, []);

  const loadMoreRemoteBranches = useCallback((repoId: RepoId) => {
    setRemoteBranchLimitByRepo((prev) => ({ ...prev, [repoId]: (prev[repoId] ?? 10) + 10 }));
  }, []);

  const canLoadMoreLocalBranches = useCallback(
    (repoId: string) =>
      (allLocalBranchesByRepo[repoId]?.length ?? 0) > (localBranchLimitByRepo[repoId] ?? 10),
    [allLocalBranchesByRepo, localBranchLimitByRepo]
  );

  const canLoadMoreRemoteBranches = useCallback(
    (repoId: string) =>
      (allRemoteBranchesByRepo[repoId]?.length ?? 0) > (remoteBranchLimitByRepo[repoId] ?? 10),
    [allRemoteBranchesByRepo, remoteBranchLimitByRepo]
  );

  return {
    allLocalBranchesByRepo,
    setAllLocalBranchesByRepo,
    allRemoteBranchesByRepo,
    setAllRemoteBranchesByRepo,
    localBranchLimitByRepo,
    setLocalBranchLimitByRepo,
    remoteBranchLimitByRepo,
    setRemoteBranchLimitByRepo,
    localBranchesByRepo,
    remoteBranchesByRepo,
    loadMoreLocalBranches,
    loadMoreRemoteBranches,
    canLoadMoreLocalBranches,
    canLoadMoreRemoteBranches,
  };
}
