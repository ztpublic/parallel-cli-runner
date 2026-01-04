/**
 * Pre-configured repository templates for common test scenarios
 */

import { GitRepoFactory, DEFAULT_TEST_REPOS_DIR } from '../GitRepoFactory.js';
import { join } from 'path';
import { RepoPreset } from '../types.js';

/**
 * Create a repository from a preset template
 */
export async function createFromPreset(
  preset: RepoPreset,
  name: string,
  parentDir: string = DEFAULT_TEST_REPOS_DIR
): Promise<ReturnType<GitRepoFactory['create']>> {
  const factory = new GitRepoFactory(parentDir, false);
  let builder = await factory.create({ name, parentDir });

  switch (preset) {
    case 'simple':
      builder = await simpleRepo(builder);
      break;
    case 'multi-branch':
      builder = await multiBranchRepo(builder);
      break;
    case 'worktree':
      builder = await worktreeRepo(builder);
      break;
    case 'submodule':
      builder = await submoduleRepo(builder);
      break;
    case 'conflict':
      builder = await conflictRepo(builder);
      break;
    case 'remote':
      builder = await remoteRepo(builder);
      break;
    case 'deep-history':
      builder = await deepHistoryRepo(builder);
      break;
    case 'merge-conflict':
      builder = await mergeConflictRepo(builder);
      break;
    default:
      throw new Error(`Unknown preset: ${preset}`);
  }

  return builder;
}

/**
 * Simple repository with main branch and a few commits
 */
async function simpleRepo(builder: Awaited<ReturnType<GitRepoFactory['create']>>) {
  return builder
    .writeFile('README.md', '# Simple Repository\n\nThis is a simple test repository.')
    .commit('Initial commit')
    .writeFile('src/index.ts', 'console.log("Hello, world!");')
    .commit('Add source file');
}

/**
 * Repository with multiple branches and commits
 */
async function multiBranchRepo(builder: Awaited<ReturnType<GitRepoFactory['create']>>) {
  await builder
    .writeFile('README.md', '# Multi-Branch Repository')
    .commit('Initial commit');

  // Create feature-a branch
  await builder.branch('feature-a');
  await builder
    .writeFile('feature-a.txt', 'Feature A implementation')
    .commit('Add feature A')
    .writeFile('feature-a-test.txt', 'Feature A tests')
    .commit('Add feature A tests');

  // Create feature-b branch from main
  await builder.checkout('main');
  await builder.branch('feature-b');
  await builder
    .writeFile('feature-b.txt', 'Feature B implementation')
    .commit('Add feature B');

  // Return to main
  await builder.checkout('main');

  return builder;
}

/**
 * Repository with worktrees
 */
async function worktreeRepo(builder: Awaited<ReturnType<GitRepoFactory['create']>>) {
  await builder
    .writeFile('README.md', '# Worktree Repository')
    .commit('Initial commit')
    .writeFile('main.txt', 'Main branch file')
    .commit('Add main file');

  // Create worktree for feature branch
  await builder.worktree('worktree-feature', 'feature-branch', 'main');

  // Add a commit in the worktree by navigating to its path
  const worktreePath = join(builder.getPath(), '..', 'worktree-feature');
  await builder.writeFile('../worktree-feature/feature.txt', 'Feature in worktree');
  // Note: The worktree needs its own commits, but we'll need to handle this differently

  return builder;
}

/**
 * Repository with a submodule
 */
async function submoduleRepo(builder: Awaited<ReturnType<GitRepoFactory['create']>>) {
  // First, create the submodule repo
  const factory = new GitRepoFactory(DEFAULT_TEST_REPOS_DIR, false);
  const submoduleBuilder = await factory.create({
    name: 'temp-submodule',
    parentDir: DEFAULT_TEST_REPOS_DIR,
  });
  await submoduleBuilder
    .writeFile('README.md', '# Submodule Repository')
    .commit('Initial commit in submodule');

  const submodulePath = submoduleBuilder.getPath();

  // Now create the main repo with the submodule
  await builder
    .writeFile('README.md', '# Repository with Submodule')
    .commit('Initial commit');

  // Note: For real testing, you'd need to initialize the submodule properly
  // This is a simplified version
  await builder.writeFile('.gitmodules', `[submodule "mysubmodule"]
\tpath = lib/mysubmodule
\turl = ${submodulePath}
`);
  await builder.commit('Add submodule reference');

  return builder;
}

/**
 * Repository with merge conflicts
 */
async function conflictRepo(builder: Awaited<ReturnType<GitRepoFactory['create']>>) {
  await builder
    .writeFile('conflict.txt', 'Original content')
    .commit('Initial commit');

  // Create conflicting branch
  await builder.branch('conflicting-branch');
  await builder.writeFile('conflict.txt', 'Branch A content');
  await builder.commit('Change on branch A');

  // Return to main and make conflicting change
  await builder.checkout('main');
  await builder.writeFile('conflict.txt', 'Branch B content');
  await builder.commit('Change on branch B');

  // Attempt to merge (will cause conflict)
  await builder.conflict('conflicting-branch', 'conflict.txt', 'Branch B content', 'Branch A content');

  return builder;
}

/**
 * Repository with remote configured
 */
async function remoteRepo(builder: Awaited<ReturnType<GitRepoFactory['create']>>) {
  await builder
    .writeFile('README.md', '# Repository with Remote')
    .commit('Initial commit');

  // Add a fake remote (for testing remote operations)
  const factory = new GitRepoFactory(DEFAULT_TEST_REPOS_DIR, false);
  const remoteBuilder = await factory.create({
    name: 'temp-remote',
    parentDir: DEFAULT_TEST_REPOS_DIR,
  });
  await remoteBuilder
    .writeFile('remote.txt', 'Remote repository content')
    .commit('Initial remote commit');

  const remotePath = remoteBuilder.getPath();

  // Configure remote
  const { git } = builder['factory'];
  await git(['remote', 'add', 'origin', remotePath], builder.getPath());
  await git(['remote', 'add', 'upstream', remotePath], builder.getPath());

  return builder;
}

/**
 * Repository with deep commit history
 */
async function deepHistoryRepo(builder: Awaited<ReturnType<GitRepoFactory['create']>>) {
  await builder.writeFile('README.md', '# Deep History Repository').commit('Initial commit');

  // Create many commits
  for (let i = 1; i <= 50; i++) {
    await builder.appendFile('history.txt', `Commit number ${i}\n`);
    await builder.commit(`Commit ${i}`);
  }

  // Create some branches at different points
  await builder.branch('branch-at-10');
  await builder.writeFile('branch10.txt', 'Branch at 10').commit('Add to branch at 10');

  await builder.checkout('main');
  await builder.branch('branch-at-30');
  await builder.writeFile('branch30.txt', 'Branch at 30').commit('Add to branch at 30');

  await builder.checkout('main');

  return builder;
}

/**
 * Repository with staged merge conflicts (not committed)
 */
async function mergeConflictRepo(builder: Awaited<ReturnType<GitRepoFactory['create']>>) {
  await builder
    .writeFile('README.md', '# Merge Conflict Repository')
    .writeFile('shared.txt', 'Original content')
    .commit('Initial commit');

  // Create feature branch with different content
  await builder.branch('feature');
  await builder.writeFile('shared.txt', 'Feature branch content');
  await builder.commit('Modify shared file in feature');

  // Return to main and make conflicting change
  await builder.checkout('main');
  await builder.writeFile('shared.txt', 'Main branch content');
  await builder.commit('Modify shared file in main');

  // Attempt merge to create staged conflict
  const { git } = builder['factory'];
  await git(['merge', 'feature', '--no-commit', '--no-ff'], builder.getPath());

  return builder;
}

// Export all preset names for type safety
export const PRESETS: RepoPreset[] = [
  'simple',
  'multi-branch',
  'worktree',
  'submodule',
  'conflict',
  'remote',
  'deep-history',
  'merge-conflict',
];
