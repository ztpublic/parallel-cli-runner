import { IconName } from "../components/Icons";

export type BranchItem = {
  name: string;
  current?: boolean;
  lastCommit: string;
};

export type CommitItem = {
  id: string;
  message: string;
  author: string;
  date: string;
};

export type WorktreeItem = {
  branch: string;
  path: string;
};

export type ChangeStatus = "modified" | "added" | "deleted";

export type ChangedFile = {
  path: string;
  status: ChangeStatus;
  staged: boolean;
};

export type GitTabId = "branches" | "commits" | "commit" | "worktrees" | "remotes";

export type GitTab = {
  id: GitTabId;
  label: string;
  icon: IconName;
};

export type RemoteItem = {
  name: string;
  fetch: string;
  push: string;
};
