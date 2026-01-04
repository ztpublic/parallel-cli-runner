# Git Repository Factory for E2E Tests - Implementation Plan

## Overview
Implement a comprehensive system for creating real git repositories for e2e testing. This infrastructure allows creating various types of repos (different branches, commits, submodules, worktrees, tags) through a fluent builder API.

## Architecture

```
e2e/
├── git-repo-factory/           # Repo creation utilities
│   ├── index.ts               # Main exports
│   ├── GitRepoFactory.ts      # Core factory class
│   ├── GitRepoBuilder.ts      # Main fluent builder
│   ├── builders/              # Specialized builders
│   │   ├── BranchBuilder.ts
│   │   ├── WorktreeBuilder.ts
│   │   ├── SubmoduleBuilder.ts
│   │   ├── TagBuilder.ts
│   │   ├── MergeConflictBuilder.ts
│   │   └── CommitBuilder.ts
│   └── presets/               # Pre-configured templates
│       ├── index.ts
│       └── *.ts
├── fixtures.ts                # Extended with repo fixtures
├── test-data/                 # Dedicated location (gitignored)
│   └── repos/                 # Created on-demand
└── *.spec.ts                  # E2E tests using real repos
```

## Implementation Steps

### Step 1: Core Types and Interfaces
- Define `GitRepoInfo` interface (path, name, config)
- Define `BranchInfo`, `CommitInfo`, `WorktreeInfo`, etc.
- Define `RepoPreset` type for pre-configured scenarios

### Step 2: GitRepoFactory Class
- Static factory methods: `create()`, `fromTemplate()`, `fromPreset()`
- Core git operations: `init()`, `commit()`, `branch()`, `checkout()`
- Utility methods: `writeFile()`, `deleteFile()`

### Step 3: Fluent Builder Pattern
- `GitRepoBuilder` - Main entry point
- Chaining methods for building complex repos
- `build()` method to finalize and return repo info

### Step 4: Specialized Builders
- `BranchBuilder` - Create branches with various configurations
- `WorktreeBuilder` - Setup worktrees with different states
- `SubmoduleBuilder` - Add submodules with depth options
- `TagBuilder` - Create annotated and lightweight tags
- `MergeConflictBuilder` - Intentionally create conflicts
- `CommitBuilder` - Create commits with messages, authors, dates

### Step 5: Presets
- `simpleRepo()` - Basic repo with main branch
- `multiBranchRepo()` - Multiple branches with commits
- `worktreeRepo()` - Repo with multiple worktrees
- `submoduleRepo()` - Repo with submodules
- `conflictRepo()` - Repo with merge conflicts
- `remoteRepo()` - Repo with remotes configured

### Step 6: Playwright Integration
- Custom fixture `repoFactory` in `fixtures.ts`
- `beforeEach`/`afterEach` hooks for automatic cleanup
- Test project utilities for opening repos in app

### Step 7: Cleanup Utilities
- `cleanupRepos()` - Remove test repos
- `cleanupOldRepos()` - Remove repos older than X hours
- `.gitignore` configuration for test-data directory

## Usage Examples

```typescript
// Simple repo
const repo = await GitRepoFactory.create('simple-test')
  .withInitialCommit('Initial commit')
  .build();

// Multi-branch repo
const repo = await GitRepoFactory.create('multi-branch')
  .withInitialCommit('Initial')
  .withBranch('feature-a')
    .withCommit('Feature A implementation')
    .withCommit('Feature A tests')
  .withBranch('feature-b')
    .withCommit('Feature B implementation')
  .build();

// Using preset
const repo = await GitRepoFactory.fromPreset('worktree-repo', 'my-worktree-test');

// In e2e test
test('can display worktree status', async ({ repoFactory, page }) => {
  const repo = await repoFactory.fromPreset('worktree-repo', 'worktree-status-test');
  await openRepo(page, repo.path);
  // ... test assertions
});
```

## Test Data Directory

The `e2e/test-data/repos/` directory will contain:
- Temporarily created repos during test runs
- Cleanup of repos older than 24 hours (configurable)
- Added to `.gitignore` to prevent committing test repos

## Integration Points

1. **Tauri Mock Layer** - May need updates to work with real repos
2. **Folder Opening** - Tests need to open real repo paths
3. **App State** - Proper session handling for real git operations
