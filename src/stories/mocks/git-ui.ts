import {
  BranchItem,
  CommitItem,
  WorktreeItem,
  RemoteItem,
  GitTab,
  ChangedFile,
} from "../../types/git-ui";

export const initialLocalBranches: BranchItem[] = [
  { name: "main", current: true, lastCommit: "Fix: Update dependencies" },
  { name: "feature/new-ui", lastCommit: "Add workspace overview" },
  { name: "bugfix/terminal-crash", lastCommit: "Stabilize xterm resize" },
];

export const initialRemoteBranches: BranchItem[] = [
  { name: "origin/main", lastCommit: "Fix: Update dependencies" },
  { name: "origin/develop", lastCommit: "Merge feature branches" },
];

export const initialCommits: CommitItem[] = [
  { id: "a3f8d2e", message: "Fix: Update dependencies", author: "John Doe", date: "2 hours ago" },
  { id: "b7e4c1f", message: "Add workspace overview", author: "Jane Smith", date: "5 hours ago" },
  { id: "c9a2d5b", message: "Stabilize xterm resize", author: "Bob Wilson", date: "1 day ago" },
  { id: "d4f7e8a", message: "Initial commit", author: "John Doe", date: "3 days ago" },
];

export const initialWorktrees: WorktreeItem[] = [
  { branch: "feature/new-ui", path: "/home/user/projects/repo-new-ui" },
  { branch: "bugfix/terminal-crash", path: "/home/user/projects/repo-bugfix" },
  { branch: "feature/api-integration", path: "/home/user/worktrees/api-work" },
];

export const initialRemotes: RemoteItem[] = [
  {
    name: "origin",
    fetch: "https://github.com/user/repo.git",
    push: "https://github.com/user/repo.git",
  },
];

export const initialTabs: GitTab[] = [
  { id: "branches", label: "Branches", icon: "branch" },
  { id: "commits", label: "Commits", icon: "commit" },
  { id: "commit", label: "Commit", icon: "commit" },
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
