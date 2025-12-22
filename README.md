# parallel-cli-runner

Tauri + React desktop app for running multiple terminal panes side‑by‑side and managing “agents” as git worktrees (each agent gets its own branch + worktree directory and can run a start command).

## Development

- Install deps: `npm install`
- Run app: `npm run tauri dev`
- Build frontend: `npm run build`
- Build app bundle: `npm run tauri build`

## How agents/worktrees are stored

When you create an agent, the backend:

- Creates a new branch: `parallel/agents/<slug>-<id>`
- Adds a git worktree under: `.parallel-worktrees/agents/<slug>-<id>`
- Persists agent metadata JSON under: `.parallel-cli/agents/<agent-id>.json`

The UI binds to a git repo and can re-load existing agents from `.parallel-cli/agents`.

## Notes

- `dist/`, `node_modules/`, `.parallel-cli/`, and `.parallel-worktrees/` are ignored via `.gitignore`.
