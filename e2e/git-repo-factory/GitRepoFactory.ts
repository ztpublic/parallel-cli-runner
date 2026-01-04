/**
 * GitRepoFactory - Core class for creating and managing git repositories for e2e tests
 */

import {
  GitRepoInfo,
  GitResult,
  RepoConfig,
  CommitOptions,
  BranchOptions,
  TagOptions,
  WorktreeOptions,
  SubmoduleOptions,
  GitUser,
  DEFAULT_GIT_USER,
  CommitInfo,
  BranchInfo,
} from './types.js';
import { execSync } from 'child_process';
import { mkdir, rm, writeFile, appendFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Default parent directory for test repositories
 */
export const DEFAULT_TEST_REPOS_DIR = join(__dirname, '../test-data/repos');

/**
 * Core factory class for creating and managing git repositories
 */
export class GitRepoFactory {
  private repos: Map<string, GitRepoInfo> = new Map();
  private worktrees: string[] = [];

  constructor(
    private parentDir: string = DEFAULT_TEST_REPOS_DIR,
    private cleanupOldRepos: boolean = true
  ) {}

  /**
   * Create a new repository
   */
  async create(config: RepoConfig): Promise<GitRepoBuilder> {
    const repoPath = join(config.parentDir || this.parentDir, config.name);

    // Clean up existing repo if it exists
    if (existsSync(repoPath)) {
      await this.removeDirectory(repoPath);
    }

    await mkdir(repoPath, { recursive: true });

    // Initialize git repo
    await this.git(['init'], repoPath);

    // Set initial branch name if specified (and supported by git version)
    const initialBranch = config.initialBranch || 'main';
    try {
      await this.git(['checkout', '-b', initialBranch], repoPath);
    } catch {
      // Fallback: rename master to main
      await this.git(['branch', '-M', initialBranch], repoPath);
    }

    // Configure git user
    await this.git(['config', 'user.name', DEFAULT_GIT_USER.name], repoPath);
    await this.git(['config', 'user.email', DEFAULT_GIT_USER.email], repoPath);

    const repoInfo: GitRepoInfo = {
      path: repoPath,
      name: config.name,
      currentBranch: initialBranch,
      branches: [initialBranch],
      commits: [],
    };

    this.repos.set(config.name, repoInfo);

    const builder = new GitRepoBuilder(repoInfo, this);

    // Make initial commit if requested
    if (config.withInitialCommit) {
      const message = config.initialCommitMessage || 'Initial commit';
      // Use allowEmpty since we're creating an empty repo with no files yet
      await builder.commit(message, { allowEmpty: true, stageAll: true });
    }

    return builder;
  }

  /**
   * Get info for a created repository
   */
  getRepoInfo(name: string): GitRepoInfo | undefined {
    return this.repos.get(name);
  }

  /**
   * Get all created repositories
   */
  getAllRepos(): GitRepoInfo[] {
    return Array.from(this.repos.values());
  }

  /**
   * Escape a shell argument
   */
  private escapeShellArg(arg: string): string {
    if (/^[a-zA-Z0-9/_\-\.\:=]+$/.test(arg)) {
      return arg;
    }
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Execute a git command in the specified directory
   */
  async git(args: string[], cwd: string): Promise<GitResult> {
    try {
      const escapedArgs = args.map(arg => this.escapeShellArg(arg));
      const stdout = execSync(`git ${escapedArgs.join(' ')}`, {
        cwd,
        encoding: 'utf-8',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      return {
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: '',
        success: true,
      };
    } catch (error: any) {
      return {
        exitCode: error.status || 1,
        stdout: error.stdout?.toString().trim() || '',
        stderr: error.stderr?.toString().trim() || '',
        success: false,
      };
    }
  }

  /**
   * Execute a git command and return stdout
   */
  gitSync(args: string[], cwd: string): string {
    const escapedArgs = args.map(arg => this.escapeShellArg(arg));
    return execSync(`git ${escapedArgs.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  }

  /**
   * Write a file to a repository
   */
  async writeFile(repoPath: string, filePath: string, content: string): Promise<void> {
    const fullPath = join(repoPath, filePath);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  /**
   * Append content to a file in a repository
   */
  async appendFile(repoPath: string, filePath: string, content: string): Promise<void> {
    const fullPath = join(repoPath, filePath);
    await appendFile(fullPath, content, 'utf-8');
  }

  /**
   * Delete a file from a repository
   */
  async deleteFile(repoPath: string, filePath: string): Promise<void> {
    const fullPath = join(repoPath, filePath);
    await rm(fullPath, { force: true });
  }

  /**
   * Stage files in a repository
   */
  async stageFiles(repoPath: string, files: string[]): Promise<void> {
    await this.git(['add', ...files], repoPath);
  }

  /**
   * Stage all changes in a repository
   */
  async stageAll(repoPath: string): Promise<void> {
    await this.git(['add', '-A'], repoPath);
  }

  /**
   * Create a commit
   */
  async commit(repoPath: string, options: CommitOptions): Promise<string> {
    if (options.stageAll) {
      await this.stageAll(repoPath);
    }

    const args = ['commit'];

    if (options.allowEmpty) {
      args.push('--allow-empty');
    }

    args.push('-m', options.message);

    if (options.author) {
      args.push('--author', `${options.author.name} <${options.author.email}>`);
    }

    if (options.date) {
      args.push('--date', typeof options.date === 'number' ? options.date.toString() : options.date);
    }

    const result = await this.git(args, repoPath);

    if (!result.success) {
      throw new Error(`Failed to commit: ${result.stderr}`);
    }

    // Extract commit hash from output
    const match = result.stdout.match(/\[([a-f0-9]+)\]/);
    return match ? match[1] : this.gitSync(['rev-parse', 'HEAD'], repoPath);
  }

  /**
   * Create a branch
   */
  async createBranch(repoPath: string, options: BranchOptions): Promise<void> {
    const args = ['branch'];

    if (options.startPoint) {
      args.push(options.startPoint);
    }

    args.push(options.name);

    await this.git(args, repoPath);

    if (options.checkout) {
      await this.checkout(repoPath, options.name);
    }
  }

  /**
   * Checkout a branch or commit
   */
  async checkout(repoPath: string, ref: string, createNew: boolean = false): Promise<void> {
    const args = ['checkout'];
    if (createNew) {
      args.push('-b');
    }
    args.push(ref);
    await this.git(args, repoPath);
  }

  /**
   * Create a tag
   */
  async createTag(repoPath: string, options: TagOptions): Promise<void> {
    if (options.annotated) {
      await this.git(
        ['tag', '-a', options.name, '-m', options.message || '', ...(options.target ? [options.target] : [])],
        repoPath
      );
    } else {
      await this.git(['tag', options.name, ...(options.target ? [options.target] : [])], repoPath);
    }
  }

  /**
   * Create a worktree
   */
  async createWorktree(repoPath: string, options: WorktreeOptions): Promise<string> {
    const args = ['worktree', 'add', options.path, '-b', options.branch];

    if (options.startPoint) {
      args.push(options.startPoint);
    }

    await this.git(args, repoPath);
    this.worktrees.push(options.path);
    return options.path;
  }

  /**
   * Add a submodule
   */
  async addSubmodule(repoPath: string, options: SubmoduleOptions): Promise<void> {
    const args = ['submodule', 'add'];

    if (options.branch) {
      args.push('-b', options.branch);
    }

    if (options.name) {
      args.push('--name', options.name);
    }

    args.push(options.url, options.path);

    await this.git(args, repoPath);
  }

  /**
   * Create a merge conflict
   */
  async createConflict(repoPath: string, branch: string, filePath: string, ourContent: string, theirContent: string): Promise<void> {
    // Store current branch
    const currentBranch = this.gitSync(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);

    // Create and checkout a conflicting branch
    await this.createBranch(repoPath, { name: branch, checkout: true });
    await this.writeFile(repoPath, filePath, theirContent);
    await this.stageAll(repoPath);
    await this.commit(repoPath, { message: `Change on ${branch}` });

    // Go back to original branch
    await this.checkout(repoPath, currentBranch);
    await this.writeFile(repoPath, filePath, ourContent);
    await this.stageAll(repoPath);
    await this.commit(repoPath, { message: `Change on ${currentBranch}` });

    // Attempt merge to create conflict
    await this.git(['merge', branch, '--no-commit', '--no-ff'], repoPath);
  }

  /**
   * Get current commit hash
   */
  getCurrentCommit(repoPath: string): string {
    return this.gitSync(['rev-parse', 'HEAD'], repoPath);
  }

  /**
   * Get all branches
   */
  getBranches(repoPath: string): BranchInfo[] {
    const output = this.gitSync(['branch', '-a', '--format=%(refname:short)%(HEAD)%(objectname)'], repoPath);
    return output.split('\n').filter(Boolean).map(line => {
      const isCurrent = line.includes('*') || line.includes('HEAD');
      const parts = line.replace('*', '').replace('HEAD', '').trim().split(' ');
      return {
        name: parts[0],
        isCurrent,
        target: parts[1] || '',
      };
    });
  }

  /**
   * Get commit history
   */
  getCommitHistory(repoPath: string, maxCount: number = 100): CommitInfo[] {
    const format = '%H|%an|%ae|%at|%s';
    const output = this.gitSync(['log', `-${maxCount}`, `--format=${format}`], repoPath);

    return output.split('\n').filter(Boolean).map(line => {
      const [hash, author, email, timestamp, ...messageParts] = line.split('|');
      return {
        hash,
        author,
        email,
        timestamp: parseInt(timestamp, 10),
        message: messageParts.join('|'),
      };
    });
  }

  /**
   * Clean up a specific repository
   */
  async cleanupRepo(name: string): Promise<void> {
    const repo = this.repos.get(name);
    if (!repo) return;

    await this.removeDirectory(repo.path);
    this.repos.delete(name);
  }

  /**
   * Clean up all created repositories
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.repos.keys()).map(name => this.cleanupRepo(name));
    await Promise.all(cleanupPromises);

    // Also clean up any worktrees
    for (const worktreePath of this.worktrees) {
      if (existsSync(worktreePath)) {
        await this.removeDirectory(worktreePath);
      }
    }
    this.worktrees = [];
  }

  /**
   * Remove a directory recursively
   */
  private async removeDirectory(path: string): Promise<void> {
    try {
      await rm(path, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Fluent builder for constructing repositories
 */
export class GitRepoBuilder {
  constructor(
    private repo: GitRepoInfo,
    private factory: GitRepoFactory
  ) {}

  /**
   * Add a commit with the given message
   */
  async commit(message: string, options?: Partial<CommitOptions>): Promise<this> {
    const hash = await this.factory.commit(this.repo.path, {
      message,
      stageAll: true,
      ...options,
    });
    this.repo.commits.push(hash);
    return this;
  }

  /**
   * Create a new branch
   */
  async branch(name: string, checkout?: boolean): Promise<this> {
    await this.factory.createBranch(this.repo.path, { name, checkout });
    if (!this.repo.branches.includes(name)) {
      this.repo.branches.push(name);
    }
    if (checkout) {
      this.repo.currentBranch = name;
    }
    return this;
  }

  /**
   * Checkout a branch
   */
  async checkout(branch: string): Promise<this> {
    await this.factory.checkout(this.repo.path, branch);
    this.repo.currentBranch = branch;
    return this;
  }

  /**
   * Write a file
   */
  async writeFile(filePath: string, content: string): Promise<this> {
    await this.factory.writeFile(this.repo.path, filePath, content);
    return this;
  }

  /**
   * Append to a file
   */
  async appendFile(filePath: string, content: string): Promise<this> {
    await this.factory.appendFile(this.repo.path, filePath, content);
    return this;
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<this> {
    await this.factory.deleteFile(this.repo.path, filePath);
    return this;
  }

  /**
   * Create a tag
   */
  async tag(name: string, message?: string, annotated: boolean = true): Promise<this> {
    await this.factory.createTag(this.repo.path, { name, message, annotated });
    return this;
  }

  /**
   * Create a worktree
   */
  async worktree(path: string, branch: string, startPoint?: string): Promise<this> {
    const worktreePath = await this.factory.createWorktree(this.repo.path, {
      path: join(this.repo.path, '..', path),
      branch,
      startPoint,
    });
    if (!this.repo.worktrees) {
      this.repo.worktrees = [];
    }
    this.repo.worktrees.push(worktreePath);
    return this;
  }

  /**
   * Add a submodule
   */
  async submodule(url: string, path: string): Promise<this> {
    await this.factory.addSubmodule(this.repo.path, { url, path });
    if (!this.repo.submodules) {
      this.repo.submodules = [];
    }
    this.repo.submodules.push(join(this.repo.path, path));
    return this;
  }

  /**
   * Create a merge conflict
   */
  async conflict(branch: string, filePath: string, ourContent: string, theirContent: string): Promise<this> {
    await this.factory.createConflict(this.repo.path, branch, filePath, ourContent, theirContent);
    return this;
  }

  /**
   * Return the repository info
   */
  build(): GitRepoInfo {
    return this.repo;
  }

  /**
   * Get the repository path
   */
  getPath(): string {
    return this.repo.path;
  }
}
