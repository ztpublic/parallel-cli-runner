import { useCallback, useRef, useState } from "react";
import { gitListCommits } from "../../services/backend";
import type { CommitInfoDto } from "../../types/git";
import type { CommitItem, WorktreeItem } from "../../types/git-ui";

type RepoId = string;

const COMMITS_PAGE_SIZE = 10;

export function mapCommits(commits: CommitInfoDto[]): CommitItem[] {
  return commits.map((commit) => ({
    id: commit.id.slice(0, 7),
    message: commit.summary,
    author: commit.author,
    date: commit.relative_time,
  }));
}

export function useGitCommits(worktreesByRepo: Record<RepoId, WorktreeItem[]>) {
  const loadMoreSeqRef = useRef<Record<RepoId, Record<string, number>>>({});
  const [worktreeCommitsByRepo, setWorktreeCommitsByRepo] = useState<
    Record<RepoId, Record<string, CommitItem[]>>
  >({});
  const [commitsSkipByWorktreeByRepo, setCommitsSkipByWorktreeByRepo] = useState<
    Record<RepoId, Record<string, number>>
  >({});
  const [hasMoreCommitsByWorktreeByRepo, setHasMoreCommitsByWorktreeByRepo] = useState<
    Record<RepoId, Record<string, boolean>>
  >({});
  const [loadingMoreCommitsByWorktreeByRepo, setLoadingMoreCommitsByWorktreeByRepo] = useState<
    Record<RepoId, Record<string, boolean>>
  >({});

  const loadMoreCommits = useCallback(
    async (repoId: RepoId, worktreePath: string) => {
      const worktrees = worktreesByRepo[repoId] ?? [];
      const hasMore = hasMoreCommitsByWorktreeByRepo[repoId]?.[worktreePath];
      const isLoading = loadingMoreCommitsByWorktreeByRepo[repoId]?.[worktreePath];
      if (!worktrees.some((worktree) => worktree.path === worktreePath) || !hasMore || isLoading) {
        return;
      }

      const repoRequests = loadMoreSeqRef.current[repoId] ?? {};
      const requestId = (repoRequests[worktreePath] ?? 0) + 1;
      loadMoreSeqRef.current[repoId] = { ...repoRequests, [worktreePath]: requestId };
      setLoadingMoreCommitsByWorktreeByRepo((prev) => ({
        ...prev,
        [repoId]: { ...(prev[repoId] ?? {}), [worktreePath]: true },
      }));
      try {
        const skip = commitsSkipByWorktreeByRepo[repoId]?.[worktreePath] ?? 0;
        const nextSkip = skip + COMMITS_PAGE_SIZE;
        const moreCommits = await gitListCommits({
          cwd: worktreePath,
          limit: COMMITS_PAGE_SIZE,
          skip: nextSkip,
        });

        if ((loadMoreSeqRef.current[repoId]?.[worktreePath] ?? 0) !== requestId) {
          return;
        }

        setWorktreeCommitsByRepo((prev) => ({
          ...prev,
          [repoId]: {
            ...(prev[repoId] ?? {}),
            [worktreePath]: [
              ...(prev[repoId]?.[worktreePath] ?? []),
              ...mapCommits(moreCommits),
            ],
          },
        }));
        setCommitsSkipByWorktreeByRepo((prev) => ({
          ...prev,
          [repoId]: { ...(prev[repoId] ?? {}), [worktreePath]: nextSkip },
        }));
        if (moreCommits.length < COMMITS_PAGE_SIZE) {
          setHasMoreCommitsByWorktreeByRepo((prev) => ({
            ...prev,
            [repoId]: { ...(prev[repoId] ?? {}), [worktreePath]: false },
          }));
        }
      } finally {
        if ((loadMoreSeqRef.current[repoId]?.[worktreePath] ?? 0) === requestId) {
          setLoadingMoreCommitsByWorktreeByRepo((prev) => ({
            ...prev,
            [repoId]: { ...(prev[repoId] ?? {}), [worktreePath]: false },
          }));
        }
      }
    },
    [
      commitsSkipByWorktreeByRepo,
      hasMoreCommitsByWorktreeByRepo,
      loadingMoreCommitsByWorktreeByRepo,
      worktreesByRepo,
    ]
  );

  const canLoadMoreCommits = useCallback(
    (repoId: string, worktreePath: string) =>
      hasMoreCommitsByWorktreeByRepo[repoId]?.[worktreePath] ?? false,
    [hasMoreCommitsByWorktreeByRepo]
  );

  const isLoadingMoreCommits = useCallback(
    (repoId: string, worktreePath: string) =>
      loadingMoreCommitsByWorktreeByRepo[repoId]?.[worktreePath] ?? false,
    [loadingMoreCommitsByWorktreeByRepo]
  );

  return {
    worktreeCommitsByRepo,
    setWorktreeCommitsByRepo,
    commitsSkipByWorktreeByRepo,
    setCommitsSkipByWorktreeByRepo,
    hasMoreCommitsByWorktreeByRepo,
    setHasMoreCommitsByWorktreeByRepo,
    loadingMoreCommitsByWorktreeByRepo,
    setLoadingMoreCommitsByWorktreeByRepo,
    loadMoreCommits,
    canLoadMoreCommits,
    isLoadingMoreCommits,
  };
}
