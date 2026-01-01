# parallel-cli-runner

Tauri + React desktop app for running multiple terminal panes alongside a Git-focused sidebar (status, branches, commits, stashes, remotes, worktrees, diffs).

## Repo layout

- `src/` — React + Vite UI. Storybook stories live in `src/stories`.
- `src-tauri/` — Tauri backend for PTY sessions and Git operations.
- `ai-elements-fork/` — vendored ACP/AI Elements UI template used by Storybook reference stories.

## Development

- Install deps: `npm install`
- Run Tauri app: `npm run tauri dev`
- Run in browser (Tauri mocked): `npm run dev:browser`
- Storybook: `npm run storybook`
- Build frontend: `npm run build`
- Build Tauri bundle: `npm run tauri build`
- Build Storybook: `npm run build-storybook`

## Git & terminal notes

- Git data is read directly from local repositories; no extra metadata is stored outside the repos themselves.
- Worktrees are standard git worktrees created/removed via the sidebar actions.
- Terminal panes are backed by PTY sessions managed in the Tauri backend.
