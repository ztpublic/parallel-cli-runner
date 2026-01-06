# parallel-cli-runner

Tauri + React app for running multiple terminal panes alongside a Git-focused sidebar (status, branches, commits, stashes, remotes, worktrees, diffs). The same UI is also packaged as a VS Code extension that talks to the Rust backend over WebSocket.

## Repo layout

- `src/` — React + Vite UI. Storybook stories live in `src/stories`.
- `src-tauri/` — Tauri backend for PTY sessions, Git operations, and the WebSocket server mode used by the extension.
- `vscode-extension/` — VS Code extension + webview bundle (built by `npm run frontend:build:vscode`).
- `ai-elements-fork/` — vendored ACP/AI Elements reference UI used by Storybook reference stories.

## Development

- Install deps: `npm install`
- Run Tauri app: `npm run tauri dev`
- Run in browser (Tauri mocked): `npm run dev:browser`
- Storybook: `npm run storybook`
- Build frontend: `npm run build`
- Build Tauri bundle: `npm run tauri build`
- Build Storybook: `npm run build-storybook`

## VS Code extension

- Build webview assets: `npm run frontend:build:vscode`
- Compile extension: `npm --prefix vscode-extension run compile`
- Package with bundled backend: `npm run extension:package:mac-arm64` or `npm run extension:package:win-x64`
- Use an external backend by setting `PARALLEL_CLI_RUNNER_WS_URL` and `PARALLEL_CLI_RUNNER_AUTH_TOKEN`

## Git & terminal notes

- Git data is read directly from local repositories; no extra metadata is stored outside the repos themselves.
- Worktrees are standard git worktrees created/removed via the sidebar actions.
- Terminal panes are backed by PTY sessions managed in the Rust backend.

## TypeScript type generation

TypeScript types for Rust DTOs are automatically generated using the `ts-rs` crate. This ensures type safety between the Rust backend and TypeScript frontend.

### Regenerating types

When you modify Rust DTOs in `src-tauri/src/git/types.rs`, you need to regenerate the corresponding TypeScript types:

```bash
# Using cargo alias (recommended)
cargo export-types

# Or using the full command
cargo run --bin export_types --manifest-path src-tauri/Cargo.toml
```

### Verifying types are in sync

To check if TypeScript types are up to date without regenerating:

```bash
# Using cargo alias (recommended)
cargo check-types

# Or using the full command
cargo test --manifest-path src-tauri/Cargo.toml types_are_synced
```

### Type files

- `src/types/git.ts` — Auto-generated from Rust DTOs. **Do not edit manually.**
- `src/types/git-ui.ts` — UI-layer types. Manually maintained, separate from DTOs.

### CI check

A GitHub Actions workflow (`.github/workflows/type-safety.yml`) automatically verifies that types are in sync when:
- `src-tauri/src/git/types.rs` changes
- `src-tauri/src/export_types.rs` changes
- `src/types/git.ts` changes
