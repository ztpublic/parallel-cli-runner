/**
 * Git Repository Factory - E2E Test Repository Creation Utilities
 *
 * A comprehensive system for creating real git repositories for e2e testing.
 * Provides fluent builders and preset templates for common test scenarios.
 *
 * @example
 * ```ts
 * import { GitRepoFactory, createFromPreset } from './git-repo-factory';
 *
 * // Create a simple repo
 * const factory = new GitRepoFactory();
 * const repo = await factory.create({ name: 'test-repo', withInitialCommit: true })
 *   .writeFile('test.txt', 'Hello')
 *   .commit('Add test file')
 *   .build();
 *
 * // Use a preset
 * const builder = await createFromPreset('multi-branch', 'my-test');
 * const repoInfo = builder.build();
 * ```
 */

// Export core types
export type {
  GitRepoInfo,
  BranchInfo,
  CommitInfo,
  WorktreeInfo,
  TagInfo,
  RepoConfig,
  GitUser,
  DEFAULT_GIT_USER,
  BranchOptions,
  CommitOptions,
  WorktreeOptions,
  SubmoduleOptions,
  TagOptions,
  ConflictOptions,
  RepoPreset,
  GitResult,
} from './types.js';

// Export core classes
export { GitRepoFactory, GitRepoBuilder, DEFAULT_TEST_REPOS_DIR } from './GitRepoFactory.js';

// Export presets
export { createFromPreset, PRESETS } from './presets/index.js';

// Export cleanup utilities
export { cleanupOldRepos, cleanupAllRepos } from './cleanup.js';
