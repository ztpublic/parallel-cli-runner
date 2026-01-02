# TODO

## Tooling / Workflow
- [ ] Add `npm run lint` with ESLint + Prettier and configure CI to run lint + typecheck.
- [ ] Add `npm run test` (Vitest) and a `cargo test` script; wire both into CI.
- [ ] Add a scripted step to regenerate `src/types/git.ts` (from `src-tauri/src/export_types.rs`) and document when to run it.

## Frontend
- [ ] Persist UI state using the existing `src/services/storage.ts` (sidebar width, enabled repos, last active tab/layout).
- [ ] Add list virtualization for large commit/branch/worktree lists to avoid slow renders.
- [ ] Add explicit empty/error states and retry actions for repo scanning and git data loading.
- [ ] Add a user-visible "cancel scan" control while `gitScanRepos` is running.

## Backend
- [ ] Make `git_scan_repos` cancellable and run it in a blocking task so long scans do not block the command thread.
- [ ] Add depth/ignore rules (e.g., node_modules, target, vendor) to repo scanning to reduce unnecessary traversal.
- [ ] Replace remaining `unwrap()`/`expect()` in non-test code with error propagation or logging where failure is possible.

## Security / Stability
- [ ] Define a restrictive CSP in `src-tauri/tauri.conf.json` instead of `null`.
- [ ] Tighten `opener:allow-open-path` permissions to only the paths the UI actually needs.

# Project TODOs

## Refactoring & Architecture
- [ ] **Refactor `useGitRepos.ts`**: This hook is currently a "God Hook" handling too many responsibilities. Break it down into smaller, domain-specific hooks (e.g., `useGitStatus`, `useGitBranches`, `useGitDiff`).
- [ ] **Standardize Error Handling**: Create a unified error handling strategy for the Tauri command bridge to ensure consistent UI feedback.

## Feature Improvements
- [ ] **Conflict Resolution UI**: Implement a 3-way merge tool or a dedicated UI for resolving merge conflicts (backend detects them, but frontend needs a UI).
- [ ] **Git Fetch & Pull**: Add explicit UI controls for `git fetch` and `git pull`.
- [ ] **Git Tags Management**: Add a view to list, create, and delete tags.
- [ ] **Interactive Rebase**: Expand rebase support beyond basic operations to allow interactive rebasing (squash, reword, drop).
- [ ] **Stash Management**: Improve the stash UI to allow applying specific stashes (pop/apply) and inspecting stash contents more easily.

## Code Quality & Tooling
- [ ] **Linting & Formatting**: Add `eslint` and `prettier` to the project and configure scripts in `package.json` (`lint`, `format`).
- [ ] **Rust Linting**: Add `cargo clippy` to the build/check process.
- [ ] **CI/CD Pipeline**: Set up a basic pipeline (e.g., GitHub Actions) to run build, tests, and linting on push.

## Testing
- [ ] **Backend Test Coverage**: Expand Rust tests in `src-tauri/tests/git_backend.rs`, specifically for complex operations like squashing and rebase.
- [ ] **Frontend E2E Tests**: utilized existing Playwright setup to add critical path tests for the UI (repo switching, terminal opening).

## UX/UI Enhancements
- [ ] **Terminal Customization**: Allow users to configure font size, color themes, and scrollback history for the terminal panes.
- [ ] **Visual Feedback**: Improve loading states and error messages for long-running Git operations.
