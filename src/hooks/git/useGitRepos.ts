import { useCallback, useMemo, useState } from "react";
import {
  gitCommit,
  gitListBranches,
  gitListCommits,
  gitListRemoteBranches,
  gitListRemotes,
  gitListWorktrees,
  gitStageAll,
  gitStageFiles,
  gitStatus,
  gitUnstageAll,
  gitUnstageFiles,
} from "../../services/tauri";
import type {
  BranchInfoDto,
  CommitInfoDto,
  FileStatusDto,
  RemoteInfoDto,
  RepoInfoDto,
  RepoStatusDto,
  WorktreeInfoDto,
} from "../../types/git";
import type {
  BranchItem,
  ChangedFile,
  CommitItem,
  RemoteItem,
  WorktreeItem,
} from "../../types/git-ui";

const DEFAULT_COMMIT_LIMIT = 50;

function mapFileStatus(file: FileStatusDto): ChangedFile[] {
  const entries: ChangedFile[] = [];
  if (file.staged) {
    entries.push({
      path: file.path,
      status: mapChangeType(file.staged),
      staged: true,
    });
  }
  if (file.unstaged) {
    entries.push({
      path: file.path,
      status: mapChangeType(file.unstaged),
      staged: false,
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

type RepoId = string;

export function useGitRepos() {
  const [repos, setReposState] = useState<RepoInfoDto[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<RepoId | null>(null);
  const [statusByRepo, setStatusByRepo] = useState<Record<RepoId, RepoStatusDto | null>>({});
  const [localBranchesByRepo, setLocalBranchesByRepo] = useState<Record<RepoId, BranchItem[]>>(
    {}
  );
  const [remoteBranchesByRepo, setRemoteBranchesByRepo] = useState<Record<RepoId, BranchItem[]>>(
    {}
  );
  const [commitsByRepo, setCommitsByRepo] = useState<Record<RepoId, CommitItem[]>>({});
  const [worktreesByRepo, setWorktreesByRepo] = useState<Record<RepoId, WorktreeItem[]>>({});
  const [remotesByRepo, setRemotesByRepo] = useState<Record<RepoId, RemoteItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setRepos = useCallback((nextRepos: RepoInfoDto[]) => {
    setReposState(nextRepos);
    setActiveRepoId((current) => {
      if (current && nextRepos.some((repo) => repo.repo_id === current)) {
        return current;
      }
      return nextRepos[0]?.repo_id ?? null;
    });
    const allowed = new Set(nextRepos.map((repo) => repo.repo_id));
    setStatusByRepo((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => allowed.has(key)))
    );
    setLocalBranchesByRepo((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => allowed.has(key)))
    );
    setRemoteBranchesByRepo((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => allowed.has(key)))
    );
    setCommitsByRepo((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => allowed.has(key)))
    );
    setWorktreesByRepo((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => allowed.has(key)))
    );
    setRemotesByRepo((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => allowed.has(key)))
    );
  }, []);

  const refreshRepos = useCallback(
    async (repoId?: RepoId) => {
      const targets = repoId
        ? repos.filter((repo) => repo.repo_id === repoId)
        : repos;
      if (!targets.length) return;
      setLoading(true);
      setError(null);

      try {
        const results = await Promise.all(
          targets.map(async (repo) => {
            const [statusDto, local, remote, commitDtos, worktreeDtos, remoteDtos] =
              await Promise.all([
                gitStatus({ cwd: repo.root_path }),
                gitListBranches({ cwd: repo.root_path }),
                gitListRemoteBranches({ cwd: repo.root_path }),
                gitListCommits({ cwd: repo.root_path, limit: DEFAULT_COMMIT_LIMIT }),
                gitListWorktrees({ cwd: repo.root_path }),
                gitListRemotes({ cwd: repo.root_path }),
              ]);
            return {
              repoId: repo.repo_id,
              status: statusDto,
              localBranches: mapBranches(local),
              remoteBranches: mapBranches(remote),
              commits: mapCommits(commitDtos),
              worktrees: mapWorktrees(worktreeDtos),
              remotes: mapRemotes(remoteDtos),
            };
          })
        );

        setStatusByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.repoId] = result.status;
          }
          return next;
        });
        setLocalBranchesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.repoId] = result.localBranches;
          }
          return next;
        });
        setRemoteBranchesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.repoId] = result.remoteBranches;
          }
          return next;
        });
        setCommitsByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.repoId] = result.commits;
          }
          return next;
        });
        setWorktreesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.repoId] = result.worktrees;
          }
          return next;
        });
        setRemotesByRepo((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.repoId] = result.remotes;
          }
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load git data";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [repos]
  );

  const changedFilesByRepo = useMemo(() => {
    return Object.fromEntries(
      Object.entries(statusByRepo).map(([repoId, status]) => [
        repoId,
        status ? status.modified_files.flatMap(mapFileStatus) : [],
      ])
    );
  }, [statusByRepo]);

  const resolveRepo = useCallback(
    (repoId?: RepoId) => {
      const id = repoId ?? activeRepoId;
      if (!id) return null;
      const repo = repos.find((entry) => entry.repo_id === id) ?? null;
      return repo;
    },
    [activeRepoId, repos]
  );

  const stageFiles = useCallback(
    async (repoId: RepoId, paths: string[]) => {
      const repo = resolveRepo(repoId);
      if (!repo || !paths.length) return;
      await gitStageFiles({ cwd: repo.root_path, paths });
      await refreshRepos(repo.repo_id);
    },
    [refreshRepos, resolveRepo]
  );

  const unstageFiles = useCallback(
    async (repoId: RepoId, paths: string[]) => {
      const repo = resolveRepo(repoId);
      if (!repo || !paths.length) return;
      await gitUnstageFiles({ cwd: repo.root_path, paths });
      await refreshRepos(repo.repo_id);
    },
    [refreshRepos, resolveRepo]
  );

  const stageAll = useCallback(
    async (repoId: RepoId) => {
      const repo = resolveRepo(repoId);
      if (!repo) return;
      await gitStageAll({ cwd: repo.root_path });
      await refreshRepos(repo.repo_id);
    },
    [refreshRepos, resolveRepo]
  );

  const unstageAll = useCallback(
    async (repoId: RepoId) => {
      const repo = resolveRepo(repoId);
      if (!repo) return;
      await gitUnstageAll({ cwd: repo.root_path });
      await refreshRepos(repo.repo_id);
    },
    [refreshRepos, resolveRepo]
  );

  const commit = useCallback(
    async (repoId: RepoId, message: string) => {
      const repo = resolveRepo(repoId);
      if (!repo) return;
      await gitCommit({ cwd: repo.root_path, message, stageAll: false, amend: false });
      await refreshRepos(repo.repo_id);
    },
    [refreshRepos, resolveRepo]
  );

  const activeStatus = activeRepoId ? statusByRepo[activeRepoId] ?? null : null;
  const activeLocalBranches = activeRepoId ? localBranchesByRepo[activeRepoId] ?? [] : [];
  const activeRemoteBranches = activeRepoId ? remoteBranchesByRepo[activeRepoId] ?? [] : [];
  const activeCommits = activeRepoId ? commitsByRepo[activeRepoId] ?? [] : [];
  const activeWorktrees = activeRepoId ? worktreesByRepo[activeRepoId] ?? [] : [];
  const activeRemotes = activeRepoId ? remotesByRepo[activeRepoId] ?? [] : [];
  const activeChangedFiles = activeRepoId ? changedFilesByRepo[activeRepoId] ?? [] : [];

  return {
    repos,
    setRepos,
    activeRepoId,
    setActiveRepoId,
    statusByRepo,
    localBranchesByRepo,
    remoteBranchesByRepo,
    commitsByRepo,
    worktreesByRepo,
    remotesByRepo,
    changedFilesByRepo,
    activeStatus,
    activeLocalBranches,
    activeRemoteBranches,
    activeCommits,
    activeWorktrees,
    activeRemotes,
    activeChangedFiles,
    loading,
    error,
    refreshRepos,
    stageFiles,
    unstageFiles,
    stageAll,
    unstageAll,
    commit,
  };
}
