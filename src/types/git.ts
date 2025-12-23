export type FileChangeType =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "unmerged";

export type FileStatusDto = {
  path: string;
  staged: FileChangeType | null;
  unstaged: FileChangeType | null;
};

export type CommitInfoDto = {
  id: string;
  summary: string;
  author: string;
  relative_time: string;
};

export type BranchInfoDto = {
  name: string;
  current: boolean;
  last_commit: string;
};

export type RemoteInfoDto = {
  name: string;
  fetch: string;
  push: string;
};

export type WorktreeInfoDto = {
  branch: string;
  path: string;
};

export type RepoStatusDto = {
  repo_id: string;
  root_path: string;
  branch: string;
  ahead: number;
  behind: number;
  has_untracked: boolean;
  has_staged: boolean;
  has_unstaged: boolean;
  conflicted_files: number;
  modified_files: FileStatusDto[];
  latest_commit: CommitInfoDto | null;
};
