# AGENTS.md

- Repo layout: frontend lives in `src/`, Tauri backend lives in `src-tauri/`, the VS Code extension lives in `vscode-extension/`, and the ACP/AI Elements reference UI lives in `ai-elements-fork/` (used by Storybook reference stories).
- If you are editing frontend, backend, or VS Code extension code, read the nested AGENTS in that folder.
- Frontend workflows use npm scripts from the root `package.json` (Vite/Storybook). Browser mock mode uses `npm run dev:browser`.
- VS Code extension workflows use npm scripts from `vscode-extension/package.json`; webview assets come from the root `frontend:build:vscode` script.
- Backend workflows use Cargo within `src-tauri/` (also used to build the extension's bundled backend binary).
