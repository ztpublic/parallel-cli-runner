/**
 * E2E Tests for Worktree Tab, Merge, and Rebase Operations
 *
 * These tests use real git repositories to verify the Worktree functionality
 * and various merge/rebase operations work correctly.
 */

import { test, expect } from './fixtures';
import { GitRepoFactory } from './git-repo-factory';
import {
  GitTestScenario,
  getHeadCommit,
  getCurrentBranch,
  getBranches,
  getWorktrees,
  hasMergeConflicts,
  getConflictedFiles,
  readFileContent,
  getMergeBase,
} from './git-test-utils';

test.describe('Git Repository Setup for Worktree Tests', () => {
  test('creates repository with worktrees for testing', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const repo = await scenario.createWorktreeScenario('worktree-test-1');

    // Verify main repo exists
    expect(repo.path).toBeTruthy();
    expect(repo.commits.length).toBeGreaterThan(0);

    // Verify branches were created
    const branches = getBranches(repo.path);
    expect(branches).toContain('main');
    expect(branches).toContain('feature-1');
    expect(branches).toContain('feature-2');

    // Verify worktrees exist
    const worktrees = getWorktrees(repo.path);
    expect(worktrees.length).toBe(2);
    expect(worktrees.some(w => w.branch === 'feature-1')).toBeTruthy();
    expect(worktrees.some(w => w.branch === 'feature-2')).toBeTruthy();

    console.log('Worktree test repo created:', repo.path);
    console.log('Branches:', branches);
    console.log('Worktrees:', worktrees);
  });

  test('creates complex repository with multiple worktrees', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const repo = await scenario.createComplexScenario('complex-test-1');

    // Verify main repo exists
    expect(repo.path).toBeTruthy();

    // Verify all branches were created
    const branches = getBranches(repo.path);
    expect(branches).toContain('main');
    expect(branches).toContain('feature-a');
    expect(branches).toContain('bugfix-1');
    expect(branches).toContain('hotfix');

    // Verify worktrees exist
    const worktrees = getWorktrees(repo.path);
    expect(worktrees.length).toBe(3);

    console.log('Complex test repo created with', worktrees.length, 'worktrees');
  });
});

test.describe('Merge Operations', () => {
  test('creates merge conflict scenario', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const { main, feature } = await scenario.createMergeConflictScenario('merge-conflict-test');

    // Verify main branch state
    const mainContent = readFileContent(main.path, 'shared.txt');
    expect(mainContent).toBe('Main branch content');

    // Checkout feature to verify content
    const { execSync } = await import('child_process');
    execSync('git checkout feature', {
      cwd: main.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    const featureContent = readFileContent(main.path, 'shared.txt');
    expect(featureContent).toBe('Feature branch content');

    // Return to main
    execSync('git checkout main', {
      cwd: main.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    console.log('Merge conflict scenario created');
    console.log('Main branch content:', mainContent);
    console.log('Feature branch content:', featureContent);
  });

  test('detects merge conflicts after merge attempt', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const { main, feature } = await scenario.createMergeConflictScenario('conflict-detect-test');

    // Attempt to merge feature into main (will cause conflict)
    const { execSync } = await import('child_process');
    try {
      execSync(`git merge ${feature} --no-commit --no-ff`, {
        cwd: main.path,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
    } catch (e) {
      // Merge conflict expected
    }

    // Verify conflicts exist
    expect(hasMergeConflicts(main.path)).toBeTruthy();
    const conflictedFiles = getConflictedFiles(main.path);
    expect(conflictedFiles).toContain('shared.txt');

    console.log('Conflicted files:', conflictedFiles);

    // Clean up: abort merge
    execSync('git merge --abort', {
      cwd: main.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  });

  test('calculates merge base correctly', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const { main } = await scenario.createMergeConflictScenario('merge-base-test');

    const mergeBase = getMergeBase(main.path, 'main', 'feature');
    expect(mergeBase).toBeTruthy();
    expect(mergeBase.length).toBe(40); // SHA-1 hash length

    console.log('Merge base of main and feature:', mergeBase);
  });

  test('merges feature branch into main successfully', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'clean-merge-test',
      withInitialCommit: true,
    });

    // Create main branch with content
    await builder.writeFile('README.md', '# Main');
    await builder.commit('Initial commit');
    await builder.writeFile('main.js', 'console.log("main");');
    await builder.commit('Add main');

    // Create feature branch with non-conflicting change
    await builder.branch('feature');
    await builder.writeFile('feature.js', 'console.log("feature");');
    await builder.commit('Add feature');

    // Return to main and add another commit
    await builder.checkout('main');
    await builder.writeFile('main2.js', 'console.log("main2");');
    await builder.commit('Add main2');

    const repo = builder.build();

    // Merge feature into main
    await (async () => {
      const { execSync } = await import('child_process');
      execSync('git merge feature --no-edit', {
        cwd: repo.path,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
    })();

    // Verify merge succeeded
    const branches = getBranches(repo.path);
    expect(branches).toContain('feature');
    expect(branches).toContain('main');

    const currentBranch = getCurrentBranch(repo.path);
    expect(currentBranch).toBe('main');

    // Verify no conflicts
    expect(hasMergeConflicts(repo.path)).toBeFalsy();

    console.log('Clean merge completed successfully');
  });
});

test.describe('Rebase Operations', () => {
  test('creates rebase scenario', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const repo = await scenario.createRebaseScenario('rebase-test-1');

    // Verify state before rebase
    const mainHead = getHeadCommit(repo.path);
    expect(mainHead).toBeTruthy();

    const branches = getBranches(repo.path);
    expect(branches).toContain('main');
    expect(branches).toContain('feature');

    console.log('Rebase scenario created');
    console.log('Main HEAD:', mainHead);
    console.log('Branches:', branches);
  });

  test('rebases feature branch onto main', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const repo = await scenario.createRebaseScenario('rebase-onto-test');

    // Get feature branch HEAD before rebase
    await (async () => {
      const { execSync } = await import('child_process');
      execSync('git checkout feature', {
        cwd: repo.path,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
    })();
    const featureHeadBefore = getHeadCommit(repo.path);

    // Rebase feature onto main
    await (async () => {
      const { execSync } = await import('child_process');
      execSync('git rebase main', {
        cwd: repo.path,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
    })();

    // Verify rebase succeeded
    const currentBranch = getCurrentBranch(repo.path);
    expect(currentBranch).toBe('feature');

    const featureHeadAfter = getHeadCommit(repo.path);
    expect(featureHeadAfter).not.toBe(featureHeadBefore); // HEAD changed after rebase

    console.log('Feature HEAD before rebase:', featureHeadBefore);
    console.log('Feature HEAD after rebase:', featureHeadAfter);

    // Return to main
    await (async () => {
      const { execSync } = await import('child_process');
      execSync('git checkout main', {
        cwd: repo.path,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
    })();
  });

  test('handles rebase conflicts', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'rebase-conflict-test',
      withInitialCommit: true,
    });

    // Create main branch with conflicting file
    await builder.writeFile('shared.txt', 'Main content');
    await builder.commit('Initial commit');
    await builder.writeFile('main.txt', 'Main only');
    await builder.commit('Add main file');

    // Create feature branch that modifies the same file
    await builder.branch('feature', true); // checkout feature branch
    await builder.writeFile('shared.txt', 'Feature content');
    await builder.commit('Modify shared in feature');

    // Return to main and modify the same file again
    await builder.checkout('main');
    await builder.writeFile('shared.txt', 'Main content v2');
    await builder.commit('Modify shared in main again');

    const repo = builder.build();

    // Attempt rebase (will conflict)
    const { execSync } = await import('child_process');
    execSync('git checkout feature', {
      cwd: repo.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    try {
      execSync('git rebase main', {
        cwd: repo.path,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
    } catch (e) {
      // Rebase conflict expected
    }

    // Verify we're in rebase state
    const currentBranch = getCurrentBranch(repo.path);
    // During a rebase conflict, HEAD is detached, so branch name might be 'HEAD'
    expect(currentBranch === 'feature' || currentBranch === 'HEAD').toBeTruthy();

    // Check for rebase state file
    const { existsSync } = await import('fs');
    const rebaseMergeDir = repo.path + '/.git/rebase-merge';
    const inRebase = existsSync(rebaseMergeDir);

    const conflictedFiles = getConflictedFiles(repo.path);
    // Either have conflicted files or are in rebase state
    expect(conflictedFiles.length > 0 || inRebase).toBeTruthy();

    console.log('Rebase conflict detected - conflicted files:', conflictedFiles.length, 'in rebase:', inRebase);

    // Abort rebase to clean up
    execSync('git rebase --abort', {
      cwd: repo.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    // Return to main
    execSync('git checkout main', {
      cwd: repo.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  });
});

test.describe('Worktree Management', () => {
  test('lists all worktrees for a repository', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const repo = await scenario.createWorktreeScenario('worktree-list-test');

    const worktrees = getWorktrees(repo.path);
    expect(worktrees.length).toBe(2);

    // Verify each worktree has valid info
    for (const worktree of worktrees) {
      expect(worktree.branch).toBeTruthy();
      expect(worktree.path).toBeTruthy();
      console.log(`Worktree: ${worktree.branch} at ${worktree.path}`);
    }
  });

  test('creates worktree from existing branch', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'worktree-branch-test-' + Math.random().toString(36).substring(7),
      withInitialCommit: true,
    });

    // Create a branch first
    await builder.writeFile('file.txt', 'content');
    await builder.commit('Add file');
    await builder.branch('existing-branch');

    const repo = builder.build();

    // Create worktree from existing branch (with unique path)
    const { execSync } = await import('child_process');
    const uniqueId = Math.random().toString(36).substring(7);
    const worktreePath = repo.path + `/../worktree-branch-${uniqueId}`;
    execSync(`git worktree add ${worktreePath} existing-branch`, {
      cwd: repo.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    // Verify worktree was created
    const worktrees = getWorktrees(repo.path);
    expect(worktrees.some(w => w.branch === 'existing-branch')).toBeTruthy();

    console.log('Worktrees:', worktrees);
  });

  test('removes worktree', async ({ repoFactory }) => {
    const builder = await repoFactory.create({
      name: 'worktree-remove-test',
      withInitialCommit: true,
    });

    await builder.worktree('temp-worktree', 'temp-branch', 'main');
    const repo = builder.build();

    // Verify worktree exists and get the actual path
    let worktrees = getWorktrees(repo.path);
    const tempWorktree = worktrees.find(w => w.branch === 'temp-branch');
    expect(tempWorktree).toBeTruthy();

    // Remove worktree using the actual path from git
    const { execSync } = await import('child_process');
    execSync(`git worktree remove ${tempWorktree!.path}`, {
      cwd: repo.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    // Verify worktree was removed
    worktrees = getWorktrees(repo.path);
    expect(worktrees.some(w => w.branch === 'temp-branch')).toBeFalsy();

    console.log('Worktree removed successfully');
  });
});

test.describe('Integration Scenarios', () => {
  test('complex workflow with worktrees, merge, and rebase', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const repo = await scenario.createComplexScenario('integration-test-1');

    // Verify initial state
    const branches = getBranches(repo.path);
    expect(branches.length).toBeGreaterThanOrEqual(4); // main + 3 worktree branches

    const worktrees = getWorktrees(repo.path);
    expect(worktrees.length).toBe(3);

    console.log('Starting integration test with', branches.length, 'branches and', worktrees.length, 'worktrees');

    // Get the bugfix worktree path
    const bugfixWorktree = worktrees.find(w => w.branch === 'bugfix-1');
    expect(bugfixWorktree).toBeTruthy();

    // Simulate merging hotfix into main (from main repo)
    const { execSync } = await import('child_process');
    execSync('git merge hotfix --no-edit', {
      cwd: repo.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    expect(hasMergeConflicts(repo.path)).toBeFalsy();
    console.log('Hotfix merged into main successfully');

    // Simulate rebasing bugfix onto main (from bugfix worktree)
    execSync('git rebase main', {
      cwd: bugfixWorktree!.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    expect(hasMergeConflicts(bugfixWorktree!.path)).toBeFalsy();
    console.log('Bugfix-1 rebased onto main successfully');

    console.log('Integration test completed successfully');
  });

  test('workflow with divergent worktrees', async ({ repoFactory }) => {
    const scenario = new GitTestScenario(repoFactory);
    const repo = await scenario.createWorktreeScenario('divergent-test');

    // Get the actual worktree paths
    const worktrees = getWorktrees(repo.path);
    const feature1Worktree = worktrees.find(w => w.branch === 'feature-1');
    expect(feature1Worktree).toBeTruthy();
    const feature1Path = feature1Worktree!.path;

    // Make changes in main
    const { writeFile } = await import('fs/promises');
    const { execSync } = await import('child_process');
    await writeFile(repo.path + '/main-new.txt', 'New main file', 'utf-8');
    execSync('git add -A && git commit -m "Add new main file"', {
      cwd: repo.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    // Make changes in feature-1 worktree
    await writeFile(feature1Path + '/feature1-new.txt', 'New feature1 file', 'utf-8');
    execSync('git add -A && git commit -m "Add new feature1 file"', {
      cwd: feature1Path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    // Verify commits exist on both branches
    const mainHead = getHeadCommit(repo.path);
    const feature1Head = getHeadCommit(feature1Path);

    expect(mainHead).not.toBe(feature1Head); // Different commits
    console.log('Main HEAD:', mainHead);
    console.log('Feature-1 HEAD:', feature1Head);

    // Merge feature-1 into main
    execSync('git merge feature-1 --no-edit', {
      cwd: repo.path,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    // Verify merge succeeded
    expect(hasMergeConflicts(repo.path)).toBeFalsy();
    const newMainHead = getHeadCommit(repo.path);
    expect(newMainHead).not.toBe(mainHead); // HEAD moved after merge

    console.log('Divergent worktrees merged successfully');
  });
});
