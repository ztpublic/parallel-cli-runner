import { useCallback, useEffect, useMemo, useState } from "react";
import {
  gitCommit,
  gitDetectRepo,
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

const DEFAULT_CWD = ".";
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

export function useGitRepo() {
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const [status, setStatus] = useState<RepoStatusDto | null>(null);
  const [localBranches, setLocalBranches] = useState<BranchItem[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<BranchItem[]>([]);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [worktrees, setWorktrees] = useState<WorktreeItem[]>([]);
  const [remotes, setRemotes] = useState<RemoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (cwd?: string) => {
      setLoading(true);
      setError(null);
      try {
        const root = await gitDetectRepo({ cwd: cwd ?? repoRoot ?? DEFAULT_CWD });
        if (!root) {
          setRepoRoot(null);
          setStatus(null);
          setLocalBranches([]);
          setRemoteBranches([]);
          setCommits([]);
          setWorktrees([]);
          setRemotes([]);
          setLoading(false);
          return;
        }

        setRepoRoot(root);
        const [statusDto, local, remote, commitDtos, worktreeDtos, remoteDtos] =
          await Promise.all([
            gitStatus({ cwd: root }),
            gitListBranches({ cwd: root }),
            gitListRemoteBranches({ cwd: root }),
            gitListCommits({ cwd: root, limit: DEFAULT_COMMIT_LIMIT }),
            gitListWorktrees({ cwd: root }),
            gitListRemotes({ cwd: root }),
          ]);

        setStatus(statusDto);
        setLocalBranches(mapBranches(local));
        setRemoteBranches(mapBranches(remote));
        setCommits(mapCommits(commitDtos));
        setWorktrees(mapWorktrees(worktreeDtos));
        setRemotes(mapRemotes(remoteDtos));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load git data";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [repoRoot]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changedFiles = useMemo(() => {
    if (!status) return [];
    return status.modified_files.flatMap(mapFileStatus);
  }, [status]);

  const stageFiles = useCallback(
    async (paths: string[]) => {
      if (!repoRoot || !paths.length) return;
      await gitStageFiles({ cwd: repoRoot, paths });
      await refresh(repoRoot);
    },
    [repoRoot, refresh]
  );

  const unstageFiles = useCallback(
    async (paths: string[]) => {
      if (!repoRoot || !paths.length) return;
      await gitUnstageFiles({ cwd: repoRoot, paths });
      await refresh(repoRoot);
    },
    [repoRoot, refresh]
  );

  const stageAll = useCallback(async () => {
    if (!repoRoot) return;
    await gitStageAll({ cwd: repoRoot });
    await refresh(repoRoot);
  }, [repoRoot, refresh]);

  const unstageAll = useCallback(async () => {
    if (!repoRoot) return;
    await gitUnstageAll({ cwd: repoRoot });
    await refresh(repoRoot);
  }, [repoRoot, refresh]);

  const commit = useCallback(
    async (message: string) => {
      if (!repoRoot) return;
      await gitCommit({ cwd: repoRoot, message, stageAll: false, amend: false });
      await refresh(repoRoot);
    },
    [repoRoot, refresh]
  );

  return {
    repoRoot,
    status,
    localBranches,
    remoteBranches,
    commits,
    worktrees,
    remotes,
    changedFiles,
    loading,
    error,
    refresh,
    stageFiles,
    unstageFiles,
    stageAll,
    unstageAll,
    commit,
  };
}
