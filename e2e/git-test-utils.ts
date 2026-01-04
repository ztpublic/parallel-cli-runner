/**
 * Test utilities for working with git repositories in e2e tests
 */

import { GitRepoFactory, GitRepoInfo } from './git-repo-factory';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Git repository test scenario builder
 */
export class GitTestScenario {
  private repos: Map<string, GitRepoInfo> = new Map();

  constructor(private factory: GitRepoFactory) {}

  /**
   * Create a repository with multiple worktrees
   */
  async createWorktreeScenario(name: string): Promise<GitRepoInfo> {
    const builder = await this.factory.create({
      name: `${name}-main`,
      withInitialCommit: true,
    });

    // Main branch commits
    await builder.writeFile('README.md', '# Main Repository');
    await builder.commit('Initial commit');
    await builder.writeFile('main.js', 'console.log("main");');
    await builder.commit('Add main file');

    // Create feature worktree 1
    await builder.worktree(
      `${name}-feature-1`,
      'feature-1',
      'main'
    );

    // Add commits in feature-1 (by navigating to worktree path)
    const worktree1Path = join(builder.getPath(), '..', `${name}-feature-1`);
    await this.writeFileInRepo(worktree1Path, 'feature1.js', 'console.log("feature1");');
    await this.commitInRepo(worktree1Path, 'Add feature 1');
    await this.writeFileInRepo(worktree1Path, 'feature1-extra.js', 'console.log("feature1-extra");');
    await this.commitInRepo(worktree1Path, 'Add feature 1 extra');

    // Create feature worktree 2
    await builder.worktree(
      `${name}-feature-2`,
      'feature-2',
      'main'
    );

    const worktree2Path = join(builder.getPath(), '..', `${name}-feature-2`);
    await this.writeFileInRepo(worktree2Path, 'feature2.js', 'console.log("feature2");');
    await this.commitInRepo(worktree2Path, 'Add feature 2');

    // Return to main
    await this.checkoutInRepo(builder.getPath(), 'main');

    const repo = builder.build();
    this.repos.set(name, repo);
    return repo;
  }

  /**
   * Create a repository with merge conflict scenario
   */
  async createMergeConflictScenario(name: string): Promise<{ main: GitRepoInfo; feature: string }> {
    const builder = await this.factory.create({
      name: `${name}-main`,
      withInitialCommit: true,
    });

    // Create a file that will cause conflicts
    await builder.writeFile('shared.txt', 'Original content');
    await builder.commit('Add shared file');

    // Create feature branch with conflicting change
    await builder.branch('feature', true); // checkout the feature branch
    await builder.writeFile('shared.txt', 'Feature branch content');
    await builder.commit('Modify in feature');

    // Return to main and make conflicting change
    await builder.checkout('main');
    await builder.writeFile('shared.txt', 'Main branch content');
    await builder.commit('Modify in main');

    const repo = builder.build();
    this.repos.set(name, repo);
    return { main: repo, feature: 'feature' };
  }

  /**
   * Create a repository with rebase scenario
   */
  async createRebaseScenario(name: string): Promise<GitRepoInfo> {
    const builder = await this.factory.create({
      name: `${name}-main`,
      withInitialCommit: true,
    });

    // Main branch commits
    await builder.writeFile('README.md', '# Main');
    await builder.commit('Initial commit');
    await builder.writeFile('v1.txt', 'Version 1');
    await builder.commit('Release v1');
    await builder.writeFile('v1.1.txt', 'Version 1.1');
    await builder.commit('Release v1.1');

    // Create feature branch
    await builder.branch('feature', true); // checkout the feature branch
    await builder.writeFile('feature.txt', 'Feature implementation');
    await builder.commit('Add feature');
    await builder.writeFile('feature-extra.txt', 'Feature extra');
    await builder.commit('Add feature extra');

    // Add more commits to main
    await builder.checkout('main');
    await builder.writeFile('v2.txt', 'Version 2');
    await builder.commit('Release v2');

    const repo = builder.build();
    this.repos.set(name, repo);
    return repo;
  }

  /**
   * Create a complex scenario with multiple branches and worktrees
   */
  async createComplexScenario(name: string): Promise<GitRepoInfo> {
    const builder = await this.factory.create({
      name: `${name}-main`,
      withInitialCommit: true,
    });

    // Main branch
    await builder.writeFile('README.md', '# Complex Repo');
    await builder.commit('Initial commit');
    await builder.writeFile('src/index.js', 'console.log("main");');
    await builder.commit('Add index');

    // Feature worktree
    await builder.worktree(`${name}-feature-a`, 'feature-a', 'main');
    const featureAPath = join(builder.getPath(), '..', `${name}-feature-a`);
    await this.writeFileInRepo(featureAPath, 'feature-a.js', 'console.log("feature-a");');
    await this.commitInRepo(featureAPath, 'Add feature A');
    await this.writeFileInRepo(featureAPath, 'feature-a-test.js', 'console.log("test-a");');
    await this.commitInRepo(featureAPath, 'Add feature A tests');

    // Bugfix worktree
    await this.checkoutInRepo(builder.getPath(), 'main');
    await builder.worktree(`${name}-bugfix-1`, 'bugfix-1', 'main');
    const bugfixPath = join(builder.getPath(), '..', `${name}-bugfix-1`);
    await this.writeFileInRepo(bugfixPath, 'bugfix-1.js', 'console.log("bugfix-1");');
    await this.commitInRepo(bugfixPath, 'Add bugfix 1');

    // Hotfix worktree
    await this.checkoutInRepo(builder.getPath(), 'main');
    await builder.worktree(`${name}-hotfix`, 'hotfix', 'main');
    const hotfixPath = join(builder.getPath(), '..', `${name}-hotfix`);
    await this.writeFileInRepo(hotfixPath, 'hotfix.js', 'console.log("hotfix");');
    await this.commitInRepo(hotfixPath, 'Add hotfix');

    // Return to main
    await this.checkoutInRepo(builder.getPath(), 'main');

    const repo = builder.build();
    this.repos.set(name, repo);
    return repo;
  }

  /**
   * Get a created repo by name
   */
  getRepo(name: string): GitRepoInfo | undefined {
    return this.repos.get(name);
  }

  /**
   * Helper to write a file in a repo
   */
  private async writeFileInRepo(repoPath: string, file: string, content: string): Promise<void> {
    const { writeFile } = await import('fs/promises');
    const { mkdir } = await import('fs/promises');
    const fullPath = join(repoPath, file);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  /**
   * Helper to commit in a repo
   */
  private commitInRepo(repoPath: string, message: string): string {
    execSync('git add -A', { cwd: repoPath, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    const result = execSync(`git commit -m '${message}'`, {
      cwd: repoPath,
      encoding: 'utf-8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return result.trim();
  }

  /**
   * Helper to checkout in a repo
   */
  private checkoutInRepo(repoPath: string, branch: string): void {
    execSync(`git checkout ${branch}`, {
      cwd: repoPath,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  }
}

/**
 * Get commit hash at HEAD for a repo
 */
export function getHeadCommit(repoPath: string): string {
  return execSync('git rev-parse HEAD', {
    cwd: repoPath,
    encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

/**
 * Get current branch for a repo
 */
export function getCurrentBranch(repoPath: string): string {
  return execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: repoPath,
    encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

/**
 * Get all branches for a repo
 */
export function getBranches(repoPath: string): string[] {
  const output = execSync("git branch --format='%(refname:short)'", {
    cwd: repoPath,
    encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return output.trim().split('\n').filter(Boolean);
}

/**
 * Get all worktrees for a repo
 */
export function getWorktrees(repoPath: string): Array<{ branch: string; path: string }> {
  const output = execSync('git worktree list --porcelain', {
    cwd: repoPath,
    encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });

  const worktrees: Array<{ branch: string; path: string }> = [];
  let currentPath = '';
  let currentBranch = '';

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      currentPath = line.substring(9);
    } else if (line.startsWith('branch ')) {
      currentBranch = line.substring(7).replace('refs/heads/', '');
      if (currentPath !== repoPath) {
        // Only add non-main worktrees
        worktrees.push({ branch: currentBranch, path: currentPath });
      }
      currentPath = '';
      currentBranch = '';
    }
  }

  return worktrees;
}

/**
 * Check if repo has merge conflicts
 */
export function hasMergeConflicts(repoPath: string): boolean {
  try {
    const status = execSync('git status --porcelain', {
      cwd: repoPath,
      encoding: 'utf-8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    // Check for conflict markers: UU (both modified), AA (both added), DD (both deleted)
    // Also check for merge state files
    const hasConflictMarkers = status.includes('UU') || status.includes('AA') || status.includes('DD');
    const hasMergeState = existsSync(join(repoPath, '.git', 'MERGE_HEAD')) ||
                          existsSync(join(repoPath, '.git', 'MERGE_MSG'));
    return hasConflictMarkers || hasMergeState;
  } catch {
    return false;
  }
}

/**
 * Get list of conflicted files
 */
export function getConflictedFiles(repoPath: string): string[] {
  try {
    const status = execSync('git status --porcelain', {
      cwd: repoPath,
      encoding: 'utf-8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return status
      .split('\n')
      .filter(line => line.match(/^[ADU]{2}/))
      .map(line => line.substring(3));
  } catch {
    return [];
  }
}

/**
 * Read file content from repo
 */
export function readFileContent(repoPath: string, filePath: string): string {
  const fullPath = join(repoPath, filePath);
  if (!existsSync(fullPath)) {
    throw new Error(`File does not exist: ${fullPath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

/**
 * Get merge base of two branches
 */
export function getMergeBase(repoPath: string, branch1: string, branch2: string): string {
  return execSync(`git merge-base ${branch1} ${branch2}`, {
    cwd: repoPath,
    encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}
