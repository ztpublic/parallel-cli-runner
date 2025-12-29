import {
  BranchItem,
  CommitItem,
  WorktreeItem,
  RemoteItem,
  StashItem,
  GitTab,
  ChangedFile,
  RepoBranchGroup,
  RepoGroup,
  RepoHeader,
} from "../../types/git-ui";

const repoAlpha: RepoHeader = {
  repoId: "/home/user/projects/alpha",
  name: "alpha",
  path: "/home/user/projects/alpha",
};

const repoBeta: RepoHeader = {
  repoId: "/home/user/projects/beta",
  name: "beta",
  path: "/home/user/projects/beta",
};

const alphaLocalBranches: BranchItem[] = [
  { name: "main", current: true, lastCommit: "Fix: Update dependencies" },
  { name: "feature/new-ui", lastCommit: "Add workspace overview" },
  { name: "bugfix/terminal-crash", lastCommit: "Stabilize xterm resize" },
];

const alphaRemoteBranches: BranchItem[] = [
  { name: "origin/main", lastCommit: "Fix: Update dependencies" },
  { name: "origin/develop", lastCommit: "Merge feature branches" },
];

const alphaCommits: CommitItem[] = [
  { id: "a3f8d2e", message: "Fix: Update dependencies", author: "John Doe", date: "2 hours ago" },
  { id: "b7e4c1f", message: "Add workspace overview", author: "Jane Smith", date: "5 hours ago" },
  { id: "c9a2d5b", message: "Stabilize xterm resize", author: "Bob Wilson", date: "1 day ago" },
  { id: "d4f7e8a", message: "Initial commit", author: "John Doe", date: "3 days ago" },
];

const alphaWorktrees: WorktreeItem[] = [
  { branch: "feature/new-ui", path: "/home/user/projects/repo-new-ui" },
  { branch: "bugfix/terminal-crash", path: "/home/user/projects/repo-bugfix" },
  { branch: "feature/api-integration", path: "/home/user/worktrees/api-work" },
];

const betaLocalBranches: BranchItem[] = [
  { name: "main", current: true, lastCommit: "Update deps" },
  { name: "feature/ops", lastCommit: "Add deploy script" },
];

const betaRemoteBranches: BranchItem[] = [{ name: "origin/main", lastCommit: "Update deps" }];

const betaCommits: CommitItem[] = [
  { id: "e1f2g3h", message: "Update deps", author: "Lee Wong", date: "3 hours ago" },
  { id: "i4j5k6l", message: "Add deploy script", author: "Lee Wong", date: "1 day ago" },
];

const betaWorktrees: WorktreeItem[] = [
  { branch: "feature/ops", path: "/home/user/projects/beta-worktrees/ops" },
];

const alphaStashes: StashItem[] = [
  {
    index: 0,
    message: "WIP on feature/new-ui: polish settings panel",
    id: "0f1a2b3c",
    relativeTime: "2 hours ago",
  },
  {
    index: 1,
    message: "WIP on main: bump deps",
    id: "7c9d8e6f",
    relativeTime: "1 day ago",
  },
];

const betaStashes: StashItem[] = [
  {
    index: 0,
    message: "WIP on main: cleanup ci config",
    id: "2a4b6c8d",
    relativeTime: "3 days ago",
  },
];

export const repoHeaders = [repoAlpha, repoBeta];

export const initialBranchGroups: RepoBranchGroup[] = [
  {
    repo: repoAlpha,
    localBranches: alphaLocalBranches,
    remoteBranches: alphaRemoteBranches,
  },
  {
    repo: repoBeta,
    localBranches: betaLocalBranches,
    remoteBranches: betaRemoteBranches,
  },
];

export const initialCommitGroups: RepoGroup<CommitItem>[] = [
  { repo: repoAlpha, items: alphaCommits },
  { repo: repoBeta, items: betaCommits },
];

export const initialWorktreeGroups: RepoGroup<WorktreeItem>[] = [
  { repo: repoAlpha, items: alphaWorktrees },
  { repo: repoBeta, items: betaWorktrees },
];

export const initialRemotes: RemoteItem[] = [
  {
    name: "origin",
    fetch: "https://github.com/user/repo.git",
    push: "https://github.com/user/repo.git",
  },
];

export const initialRemoteGroups: RepoGroup<RemoteItem>[] = [
  { repo: repoAlpha, items: initialRemotes },
  { repo: repoBeta, items: [] },
];

export const initialStashGroups: RepoGroup<StashItem>[] = [
  { repo: repoAlpha, items: alphaStashes },
  { repo: repoBeta, items: betaStashes },
];

export const initialTabs: GitTab[] = [
  { id: "branches", label: "Branches", icon: "branch" },
  { id: "commits", label: "Commits", icon: "commit" },
  { id: "commit", label: "Changes", icon: "fileEdit" },
  { id: "stashes", label: "Stashes", icon: "archive" },
  { id: "worktrees", label: "Worktrees", icon: "folder" },
  { id: "remotes", label: "Remotes", icon: "cloud" },
];

export const initialChangedFiles: ChangedFile[] = [
  { path: "src/App.tsx", status: "modified", staged: true },
  { path: "src/components/GitPanel.tsx", status: "modified", staged: true },
  { path: "src/components/TopBar.tsx", status: "added", staged: false },
  { path: "src/services/tauri.ts", status: "modified", staged: false },
  { path: "README.md", status: "deleted", staged: false },
];

export const initialChangedFileGroups: RepoGroup<ChangedFile>[] = [
  { repo: repoAlpha, items: initialChangedFiles },
  { repo: repoBeta, items: [] },
];
