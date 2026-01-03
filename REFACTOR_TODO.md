# Refactoring & Improvement TODO

## High Priority Items

### 1. Git Module Modularization (`src-tauri/src/git.rs` - 2324 lines)

**Problem**: The git.rs file is too large and handles too many responsibilities.

**Proposed Solution**: Split into focused modules:

```
src-tauri/src/git/
├── mod.rs              # Main exports
├── operations.rs       # High-level operations (commit, merge, rebase, etc.)
├── status.rs           # Status operations
├── branches.rs         # Branch listing and management
├── remotes.rs          # Remote operations (pull, push)
├── worktrees.rs        # Worktree management
├── stashes.rs          # Stash operations
├── tags.rs             # Tag operations
├── diff.rs             # Diff generation
├── scanner.rs          # Repository scanning
├── types.rs            # Shared types and DTOs
├── error.rs            # Error types
└── proxy.rs            # Proxy configuration
```

**Benefits**:
- Easier to navigate and maintain
- Better separation of concerns
- Easier to test individual modules
- Reduces compilation time for changes

---

### 2. App Component Decomposition (`src/App.tsx` - 874 lines)

**Problem**: The main App component handles too many concerns - git state, terminal layout, dialog management, repo picking.

**Proposed Solution**: Extract into focused components:

```
src/
├── App.tsx                    # Simplified orchestrator
├── app/
│   ├── AppProviders.tsx      # Context providers wrapper
│   ├── AppLayout.tsx         # Layout composition
│   ├── GitPanelContainer.tsx # Git panel with its state
│   ├── TerminalPanelContainer.tsx # Terminal panel with its state
│   ├── DialogManager.tsx     # All dialog state and handlers
│   └── RepoManager.tsx       # Repo picker and management
```

**Benefits**:
- Each component has a single responsibility
- Easier to test in isolation
- Better code reusability
- Clearer data flow

---

### 3. VS Code Extension Modularization (`vscode-extension/src/extension.ts` - 566 lines)

**Problem**: Single file handles backend spawning, webview management, settings, and WebSocket communication.

**Proposed Solution**:

```
vscode-extension/src/
├── extension.ts              # Entry point
├── backend/
│   ├── manager.ts           # Backend lifecycle management
│   ├── finder.ts            # Backend binary discovery
│   └── external.ts          # External backend support
├── webview/
│   ├── manager.ts           # Webview panel management
│   └── html.ts              # HTML generation
├── config/
│   ├── loader.ts            # Configuration loading
│   └── merger.ts            # Settings merging
└── types.ts                 # Shared types
```

**Benefits**:
- Clear separation of backend and webview concerns
- Easier to test configuration logic
- Better code organization

---

## Medium Priority Items

### 4. Type Safety Improvements

**Problem**: DTOs are manually maintained in both Rust and TypeScript, leading to potential mismatches.

**Proposed Solutions**:

**Option A**: Enhance existing `ts-rs` usage
- Audit all types exported with `#[ts_rs]`
- Add CI check to ensure TypeScript types are up to date
- Consider adding a build script to generate types automatically

**Option B**: Use a schema-first approach
- Define types in a shared schema (JSON Schema or similar)
- Generate both Rust and TypeScript from schema
- Reduces duplication and ensures consistency

**Files affected**:
- `src-tauri/src/git.rs` (all `*Dto` types)
- `src/types/git.ts`
- `src/types/git-ui.ts`

---

### 5. Error Handling Standardization

**Problem**: Error handling patterns are inconsistent across the codebase.

**Proposed Solution**:

**Backend (Rust)**:
- Create a centralized error handling module
- Define specific error types for different operations
- Add structured error context
- Consider using `anyhow` for better error chaining in application code

**Frontend (TypeScript)**:
- Standardize error display patterns
- Create reusable error components
- Add error recovery mechanisms
- Better user-facing error messages

**Benefits**:
- Consistent user experience
- Easier debugging
- Better error recovery

---

### 6. Performance Optimizations

**Git Operations Caching**:
- Add caching layer for frequently accessed git data
- Cache branch lists, commit history with TTL
- Invalidate cache on operations that modify state
- Consider using `dashmap` for concurrent cache access

**Terminal Output Processing**:
- Batch terminal output updates
- Use virtual scrolling for large outputs
- Debounce resize events

**Frontend Rendering**:
- Add `React.memo()` to expensive components
- Use `useMemo()` for expensive computations
- Implement proper key props for lists
- Consider using `useTransition()` for non-critical updates

---

### 7. Testing Improvements

**Backend Tests**:
- Current test coverage in `src-tauri/src/` is minimal
- Add unit tests for git operations
- Add integration tests for complex workflows
- Mock git operations for faster tests
- Consider using `tempfile` for test repositories

**Frontend Tests**:
- Add component tests using Vitest
- Test hooks with `@testing-library/react-hooks`
- Add integration tests for critical user flows
- Mock backend calls in tests

**Recommended files**:
```
src-tauri/src/git/tests/
├── status_test.rs
├── commit_test.rs
├── merge_test.rs
├── rebase_test.rs
└── worktree_test.rs
```

---

### 8. Code Quality & Maintainability

**Remove Code Duplication**:
- Audit `src/components/git/` for duplicated patterns
- Extract common patterns into reusable components
- Create a comprehensive component library

**Improve Type Definitions**:
- Reduce `any` types in TypeScript
- Add stricter type checking to `tsconfig.json`
- Use discriminated unions for better type narrowing

**Documentation**:
- Add JSDoc comments to public functions
- Document complex algorithms
- Add architecture decision records (ADRs)
- Improve inline comments for complex logic

---

## Low Priority Items

### 9. Dependency Updates

- Review and update outdated dependencies
- Consider removing unused dependencies
- Audit security vulnerabilities

### 10. Build & Tooling

- Add pre-commit hooks for formatting and linting
- Improve build scripts for different platforms
- Add CI/CD improvements
- Consider using `cargo workspaces` for better Rust organization

### 11. Accessibility

- Add ARIA labels to interactive elements
- Improve keyboard navigation
- Add screen reader support
- Test with accessibility tools

### 12. Internationalization

- Prepare for i18n support
- Extract hardcoded strings
- Consider date/time localization

---

## Quick Wins (Easy to implement)

1. **Add JSDoc comments** to exported functions in hooks
2. **Extract magic numbers** to named constants
3. **Add prop-types** or better TypeScript validation for component props
4. **Consistent naming conventions** across the codebase
5. **Remove unused imports** and variables
6. **Add error boundaries** for better error handling
7. **Add loading states** for async operations
8. **Improve console.log statements** (use proper logging library)
9. **Add unit tests** for utility functions
10. **Format code consistently** (run prettier/eslint)

---

## Implementation Order Suggestion

**Phase 1** (Foundation):
1. Type safety improvements (Item 4)
2. Error handling standardization (Item 5)
3. Code quality quick wins (Item 12)

**Phase 2** (Core Architecture):
4. Git module modularization (Item 1)
5. App component decomposition (Item 2)
6. VS Code extension modularization (Item 3)

**Phase 3** (Enhancement):
7. Performance optimizations (Item 6)
8. Testing improvements (Item 7)

**Phase 4** (Polish):
9. Documentation (Item 8)
10. Lower priority items (Items 9-12)

---

## Notes

- Each refactoring should be done in small, incremental steps
- Ensure tests pass after each change
- Consider using feature flags for large changes
- Communicate breaking changes to users
- Update documentation as changes are made
