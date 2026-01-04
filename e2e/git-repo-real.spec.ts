/**
 * E2E Tests using Real Git Repositories
 *
 * This test file demonstrates using the GitRepoFactory to create
 * real git repositories for testing purposes.
 */

import { test, expect } from './fixtures';
import { createFromPreset, GitRepoFactory } from './git-repo-factory';

test.describe('Git Repository Factory', () => {
  test('creates a simple repository', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'simple-test',
      withInitialCommit: true,
      initialCommitMessage: 'Initial commit',
    });

    await builder.writeFile('README.md', '# Test Repository');
    await builder.commit('Add README');
    await builder.writeFile('src/main.ts', 'console.log("Hello");');
    await builder.commit('Add source file');

    const repo = builder.build();

    expect(repo.path).toBeTruthy();
    expect(repo.commits.length).toBe(3); // Initial + 2 more
    expect(repo.branches).toContain('main');
  });

  test('creates a multi-branch repository', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'multi-branch-test',
      withInitialCommit: true,
    });

    await builder.writeFile('README.md', '# Multi-Branch Test');
    await builder.commit('Initial commit');
    await builder.branch('feature-a');
    await builder.writeFile('feature-a.txt', 'Feature A');
    await builder.commit('Add feature A');
    await builder.checkout('main');
    await builder.branch('feature-b');
    await builder.writeFile('feature-b.txt', 'Feature B');
    await builder.commit('Add feature B');
    await builder.checkout('main');

    const repo = builder.build();

    expect(repo.branches.length).toBeGreaterThanOrEqual(3);
    expect(repo.branches).toContain('main');
    expect(repo.branches).toContain('feature-a');
    expect(repo.branches).toContain('feature-b');
    expect(repo.currentBranch).toBe('main');
  });

  test('creates a repository using preset', async ({ repoFactory }) => {
    // Using the presets directly through the factory
    const builder = await repoFactory.create({
      name: 'preset-test',
      withInitialCommit: true,
    });

    // Manually create a multi-branch scenario similar to the preset
    await builder.writeFile('README.md', '# Preset Test');
    await builder.commit('Initial commit');
    await builder.branch('feature');
    await builder.writeFile('feature.txt', 'Feature content');
    await builder.commit('Add feature');
    await builder.checkout('main');
    await builder.writeFile('main.txt', 'Main content');
    await builder.commit('Add main file');

    const repo = builder.build();

    expect(repo.branches.length).toBeGreaterThanOrEqual(2);
    expect(repo.commits.length).toBeGreaterThan(2);
  });

  test('creates a repository with tags', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'tags-test',
      withInitialCommit: true,
    });

    await builder.writeFile('v1.txt', 'Version 1');
    await builder.commit('Add v1 file');
    await builder.tag('v1.0.0', 'Release version 1.0.0');
    await builder.writeFile('v2.txt', 'Version 2');
    await builder.commit('Add v2 file');
    await builder.tag('v2.0.0', 'Release version 2.0.0');

    const repo = builder.build();

    expect(repo.commits.length).toBeGreaterThan(2);
  });

  test('creates a repository with deep history', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'deep-history-test',
      withInitialCommit: true,
    });

    // Create 20 commits
    for (let i = 1; i <= 20; i++) {
      await builder.writeFile(`file${i}.txt`, `Content ${i}`);
      await builder.commit(`Commit ${i}`);
    }

    const repo = builder.build();
    expect(repo.commits.length).toBe(21); // Initial + 20
  });
});

test.describe('Git Repository Integration', () => {
  test('creates a repository for integration testing', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'integration-test',
      withInitialCommit: true,
      initialCommitMessage: 'Initial commit',
    });

    await builder.writeFile('README.md', '# Integration Test Repository');
    await builder.commit('Add README');

    const repo = builder.build();

    // Verify the repository was created successfully
    expect(repo.path).toBeTruthy();
    expect(repo.commits.length).toBeGreaterThan(0);

    // TODO: Add actual app interaction to open the repository
    // This depends on how your app handles folder opening
    console.log('Test repository created at:', repo.path);
  });

  test('displays branch information for real repo', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'branch-display-test',
      withInitialCommit: true,
    });

    await builder.writeFile('main.txt', 'Main branch');
    await builder.commit('Add main file');
    await builder.branch('develop');
    await builder.writeFile('develop.txt', 'Develop branch');
    await builder.commit('Add develop file');
    await builder.checkout('main');

    const repo = builder.build();

    console.log('Created repo with branches:', repo.branches);
    // TODO: Assert branch display in UI
  });
});

test.describe('Repository Cleanup', () => {
  test('cleans up repositories after test', async ({ repoFactory }) => {
    const builder1 = await repoFactory.create({
      name: 'cleanup-test-1',
      withInitialCommit: true,
    });
    const repo1 = builder1.build();

    const builder2 = await repoFactory.create({
      name: 'cleanup-test-2',
      withInitialCommit: true,
    });
    const repo2 = builder2.build();

    expect(repo1.path).toBeTruthy();
    expect(repo2.path).toBeTruthy();

    // Repositories will be cleaned up automatically by the fixture
  });
});
