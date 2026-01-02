# VSCode Extension Dev & Packaging

## Local development

- Build the webview bundle:
  - `npm run frontend:build:vscode`
- Compile the extension:
  - `npm --prefix vscode-extension run compile`
- Run the backend server directly (optional external backend):
  - `cargo run --manifest-path src-tauri/Cargo.toml -- --port 4210 --auth-token dev-token`
- Launch the extension from VSCode:
  - Use the `Run Server + Extension` compound launch config.

## Config and settings

- Optional config file: `.vscode/parallel-cli-runner.json`
- VSCode settings namespace: `parallelCliRunner.*`
- External backend override (useful for development):
  - `PARALLEL_CLI_RUNNER_WS_URL`
  - `PARALLEL_CLI_RUNNER_AUTH_TOKEN`

## Packaging

Scripts live in the root `package.json`:

- Webview build: `npm run frontend:build:vscode`
- Backend builds:
  - `npm run backend:build:win-x64`
  - `npm run backend:build:mac-arm64`
- Stage backend binaries into the extension:
  - `npm run backend:stage:win-x64`
  - `npm run backend:stage:mac-arm64`
- Package VSIX files:
  - `npm run extension:package:win-x64`
  - `npm run extension:package:mac-arm64`

VSIX outputs are written to `vscode-extension/` with platform suffixes.

## Runtime differences vs Tauri

- VSCode uses WebSocket-only transport; no Tauri `invoke` or event bridge.
- Dialog/openPath calls are routed via the extension host.
- Backend lifecycle is tied to the VSCode extension lifecycle, one backend per window.
