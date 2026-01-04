import { useCallback, useState } from "react";
import { gitListCommitsRange } from "../../services/backend";
import type { CommitItem } from "../../types/git-ui";
import type { WorktreeItem } from "../../types/git-ui";

type RepoId = string;
type WorktreePath = string;
type WorktreeCommitsByRepo = Record<RepoId, Record<WorktreePath, CommitItem[]>>;

export function useGitWorktrees() {
  const [worktreesByRepo, setWorktreesByRepo] = useState<Record<RepoId, WorktreeItem[]>>({});
  const [commitsByRepo, setCommitsByRepo] = useState<WorktreeCommitsByRepo>({});
  const [loadingCommitsByRepo, setLoadingCommitsByRepo] = useState<
    Record<RepoId, Record<WorktreePath, boolean>>
  >({});

  const fetchWorktreeCommits = useCallback(
    async (repoId: RepoId, repoPath: string, activeBranch: string | undefined) => {
      const worktrees = worktreesByRepo[repoId] || [];
      if (!activeBranch || worktrees.length === 0) return;

      setLoadingCommitsByRepo((prev) => ({
        ...prev,
        [repoId]: Object.fromEntries(worktrees.map((wt) => [wt.path, true])),
      }));

      try {
        const commitsByWorktree: Record<WorktreePath, CommitItem[]> = {};

        await Promise.all(
          worktrees.map(async (worktree) => {
            if (worktree.branch === activeBranch) {
              commitsByWorktree[worktree.path] = [];
              return;
            }

            try {
              const commitDtos = await gitListCommitsRange({
                cwd: repoPath,
                includeBranch: worktree.branch,
                excludeBranch: activeBranch,
              });

              commitsByWorktree[worktree.path] = commitDtos.map((dto) => ({
                id: dto.id,
                message: dto.summary,
                author: dto.author,
                date: dto.relative_time,
              }));
            } catch {
              commitsByWorktree[worktree.path] = [];
            }
          })
        );

        setCommitsByRepo((prev) => ({
          ...prev,
          [repoId]: commitsByWorktree,
        }));
      } finally {
        setLoadingCommitsByRepo((prev) => {
          const next = { ...prev };
          delete next[repoId];
          return next;
        });
      }
    },
    [worktreesByRepo]
  );

  const isLoadingWorktreeCommits = useCallback(
    (repoId: RepoId, worktreePath: WorktreePath) => {
      return loadingCommitsByRepo[repoId]?.[worktreePath] ?? false;
    },
    [loadingCommitsByRepo]
  );

  const getWorktreeCommits = useCallback(
    (repoId: RepoId, worktreePath: WorktreePath) => {
      return commitsByRepo[repoId]?.[worktreePath] ?? [];
    },
    [commitsByRepo]
  );

  return {
    worktreesByRepo,
    setWorktreesByRepo,
    commitsByRepo,
    fetchWorktreeCommits,
    isLoadingWorktreeCommits,
    getWorktreeCommits,
  };
}
