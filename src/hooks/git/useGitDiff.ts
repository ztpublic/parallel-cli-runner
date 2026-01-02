import { useMemo } from "react";
import type { FileStatusDto, RepoStatusDto } from "../../types/git";
import type { ChangedFile } from "../../types/git-ui";

type RepoId = string;

type GitDiffOptions = {
  statusByRepo: Record<RepoId, RepoStatusDto | null>;
  statusByWorktreeByRepo: Record<RepoId, Record<string, RepoStatusDto | null>>;
};

function mapChangeType(
  status: "added" | "modified" | "deleted" | "renamed" | "unmerged"
): ChangedFile["status"] {
  if (status === "added") return "added";
  if (status === "deleted") return "deleted";
  return "modified";
}

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

export function useGitDiff({ statusByRepo, statusByWorktreeByRepo }: GitDiffOptions) {
  const changedFilesByRepo = useMemo(() => {
    return Object.fromEntries(
      Object.entries(statusByRepo).map(([repoId, status]) => [
        repoId,
        status ? status.modified_files.flatMap(mapFileStatus) : [],
      ])
    );
  }, [statusByRepo]);

  const changedFilesByWorktreeByRepo = useMemo(() => {
    return Object.fromEntries(
      Object.entries(statusByWorktreeByRepo).map(([repoId, statusByPath]) => [
        repoId,
        Object.fromEntries(
          Object.entries(statusByPath).map(([path, status]) => [
            path,
            status ? status.modified_files.flatMap(mapFileStatus) : [],
          ])
        ),
      ])
    );
  }, [statusByWorktreeByRepo]);

  return {
    changedFilesByRepo,
    changedFilesByWorktreeByRepo,
  };
}
