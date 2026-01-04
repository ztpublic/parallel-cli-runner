/**
 * Core types and interfaces for the Git Repository Factory
 */

/**
 * Information about a created git repository
 */
export interface GitRepoInfo {
  /** Absolute path to the repository */
  path: string;
  /** Name/identifier of the repository */
  name: string;
  /** Current branch name */
  currentBranch: string;
  /** List of all branches */
  branches: string[];
  /** List of all commit hashes */
  commits: string[];
  /** List of worktree paths (if any) */
  worktrees?: string[];
  /** List of submodule paths (if any) */
  submodules?: string[];
}

/**
 * Information about a branch
 */
export interface BranchInfo {
  /** Branch name */
  name: string;
  /** Whether this is the current branch */
  isCurrent: boolean;
  /** The commit hash this branch points to */
  target: string;
}

/**
 * Information about a commit
 */
export interface CommitInfo {
  /** Commit hash */
  hash: string;
  /** Commit message */
  message: string;
  /** Author name */
  author: string;
  /** Author email */
  email: string;
  /** Commit timestamp */
  timestamp: number;
}

/**
 * Information about a worktree
 */
export interface WorktreeInfo {
  /** Path to the worktree */
  path: string;
  /** Branch name associated with worktree */
  branch: string;
  /** Whether this is the main worktree */
  isMain: boolean;
}

/**
 * Information about a tag
 */
export interface TagInfo {
  /** Tag name */
  name: string;
  /** Target commit hash */
  target: string;
  /** Whether this is an annotated tag */
  isAnnotated: boolean;
  /** Tag message (for annotated tags) */
  message?: string;
}

/**
 * Configuration for creating a repository
 */
export interface RepoConfig {
  /** Repository name/identifier */
  name: string;
  /** Parent directory (defaults to test-data/repos) */
  parentDir?: string;
  /** Initial branch name (defaults to 'main') */
  initialBranch?: string;
  /** Whether to make initial commit */
  withInitialCommit?: boolean;
  /** Initial commit message */
  initialCommitMessage?: string;
}

/**
 * Configuration for git user identity
 */
export interface GitUser {
  name: string;
  email: string;
}

/**
 * Default test git user
 */
export const DEFAULT_GIT_USER: GitUser = {
  name: 'Test User',
  email: 'test@example.com',
};

/**
 * Options for creating a branch
 */
export interface BranchOptions {
  /** Branch name */
  name: string;
  /** Starting point (commit or branch) */
  startPoint?: string;
  /** Whether to checkout the branch after creation */
  checkout?: boolean;
}

/**
 * Options for creating a commit
 */
export interface CommitOptions {
  /** Commit message */
  message: string;
  /** Whether to stage all changes first */
  stageAll?: boolean;
  /** Allow empty commit */
  allowEmpty?: boolean;
  /** Override default author */
  author?: GitUser;
  /** Override commit date (ISO string or timestamp) */
  date?: string | number;
}

/**
 * Options for creating a worktree
 */
export interface WorktreeOptions {
  /** Path for the worktree */
  path: string;
  /** Branch name (creates new branch if doesn't exist) */
  branch: string;
  /** Starting point for new branch */
  startPoint?: string;
}

/**
 * Options for adding a submodule
 */
export interface SubmoduleOptions {
  /** URL or path to the submodule repository */
  url: string;
  /** Path where submodule should be placed */
  path: string;
  /** Branch to checkout in submodule */
  branch?: string;
  /** Submodule name */
  name?: string;
}

/**
 * Options for creating a tag
 */
export interface TagOptions {
  /** Tag name */
  name: string;
  /** Target commit or branch (defaults to HEAD) */
  target?: string;
  /** Whether to create an annotated tag */
  annotated?: boolean;
  /** Tag message (for annotated tags) */
  message?: string;
}

/**
 * Options for creating a merge conflict
 */
export interface ConflictOptions {
  /** Branch to merge (will cause conflict) */
  branch: string;
  /** File path that will have conflicts */
  filePath: string;
  /** Content for our side of the conflict */
  ourContent: string;
  /** Content for their side of the conflict */
  theirContent: string;
}

/**
 * Preset repository configurations
 */
export type RepoPreset =
  | 'simple'
  | 'multi-branch'
  | 'worktree'
  | 'submodule'
  | 'conflict'
  | 'remote'
  | 'deep-history'
  | 'merge-conflict';

/**
 * Result of a git command execution
 */
export interface GitResult {
  /** Command exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Whether command succeeded */
  success: boolean;
}
