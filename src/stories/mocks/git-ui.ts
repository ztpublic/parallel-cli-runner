import {
  BranchItem,
  CommitItem,
  WorktreeItem,
  RemoteItem,
  SubmoduleItem,
  StashItem,
  GitTab,
  ChangedFile,
  RepoBranchGroup,
  RepoGroup,
  RepoHeader,
  WorktreeCommits,
} from "../../types/git-ui";
import { makeWorktreeTargetId } from "../../hooks/git/gitTargets";

const repoAlpha: RepoHeader = {
  repoId: "/home/user/projects/alpha",
  name: "alpha",
  path: "/home/user/projects/alpha",
  activeBranch: "main",
};

const repoBeta: RepoHeader = {
  repoId: "/home/user/projects/beta",
  name: "beta",
  path: "/home/user/projects/beta",
  activeBranch: "main",
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

const alphaMainWorktree: WorktreeItem = { branch: "main", path: repoAlpha.path };

const alphaWorktrees: WorktreeItem[] = [
  alphaMainWorktree,
  { branch: "feature/new-ui", path: "/home/user/projects/repo-new-ui" },
  { branch: "bugfix/terminal-crash", path: "/home/user/projects/repo-bugfix" },
  { branch: "feature/api-integration", path: "/home/user/worktrees/api-work" },
];

const alphaFeatureWorktreeHeader: RepoHeader = {
  repoId: makeWorktreeTargetId(repoAlpha.repoId, alphaWorktrees[1].path),
  name: `${repoAlpha.name}:${alphaWorktrees[1].branch}`,
  path: alphaWorktrees[1].path,
  activeBranch: alphaWorktrees[1].branch,
};

const betaLocalBranches: BranchItem[] = [
  { name: "main", current: true, lastCommit: "Update deps" },
  { name: "feature/ops", lastCommit: "Add deploy script" },
];

const betaRemoteBranches: BranchItem[] = [{ name: "origin/main", lastCommit: "Update deps" }];

const betaCommits: CommitItem[] = [
  { id: "e1f2g3h", message: "Update deps", author: "Lee Wong", date: "3 hours ago" },
  { id: "i4j5k6l", message: "Add deploy script", author: "Lee Wong", date: "1 day ago" },
];

const betaMainWorktree: WorktreeItem = { branch: "main", path: repoBeta.path };

const betaWorktrees: WorktreeItem[] = [
  betaMainWorktree,
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

const alphaWorktreeCommits: WorktreeCommits[] = [
  { worktree: alphaMainWorktree, commits: alphaCommits },
  { worktree: alphaWorktrees[1], commits: alphaCommits.slice(0, 2) },
  { worktree: alphaWorktrees[2], commits: alphaCommits.slice(0, 3) },
  { worktree: alphaWorktrees[3], commits: alphaCommits.slice(1, 4) },
];

const betaWorktreeCommits: WorktreeCommits[] = [
  { worktree: betaMainWorktree, commits: betaCommits },
  { worktree: betaWorktrees[1], commits: betaCommits.slice(0, 1) },
];

export const initialCommitGroups: RepoGroup<WorktreeCommits>[] = [
  { repo: repoAlpha, items: alphaWorktreeCommits },
  { repo: repoBeta, items: betaWorktreeCommits },
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

const alphaSubmodules: SubmoduleItem[] = [
  {
    name: "ui-kit",
    path: "/home/user/projects/alpha/vendor/ui-kit",
    url: "https://github.com/acme/ui-kit.git",
  },
  {
    name: "design-system",
    path: "/home/user/projects/alpha/vendor/design-system",
    url: "https://github.com/acme/design-system.git",
  },
];

export const initialSubmoduleGroups: RepoGroup<SubmoduleItem>[] = [
  { repo: repoAlpha, items: alphaSubmodules },
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
  { id: "submodules", label: "Submodules", icon: "merge" },
  { id: "remotes", label: "Remotes", icon: "cloud" },
];

export const initialChangedFiles: ChangedFile[] = [
  { path: "src/App.tsx", status: "modified", staged: true },
  { path: "src/components/GitPanel.tsx", status: "modified", staged: true },
  { path: "src/components/TopBar.tsx", status: "added", staged: false },
  { path: "src/services/backend.ts", status: "modified", staged: false },
  { path: "README.md", status: "deleted", staged: false },
];

const alphaWorktreeChangedFiles: ChangedFile[] = [
  { path: "src/features/new-ui/panel.tsx", status: "modified", staged: false },
  { path: "src/features/new-ui/theme.css", status: "added", staged: false },
];

export const initialChangedFileGroups: RepoGroup<ChangedFile>[] = [
  { repo: repoAlpha, items: initialChangedFiles },
  { repo: alphaFeatureWorktreeHeader, items: alphaWorktreeChangedFiles },
  { repo: repoBeta, items: [] },
];
