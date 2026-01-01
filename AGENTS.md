# AGENTS.md

- Repo layout: frontend lives in `src/`, Tauri backend lives in `src-tauri/`, and the ACP/AI Elements reference UI lives in `ai-elements-fork/` (used by Storybook stories).
- If you are editing frontend or backend code, read the nested AGENTS in that folder.
- Frontend workflows use npm scripts from `package.json` (Vite/Storybook). Browser mock mode uses `npm run dev:browser`.
- Backend workflows use Cargo within `src-tauri/`.
