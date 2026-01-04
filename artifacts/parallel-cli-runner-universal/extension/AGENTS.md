# AGENTS.md

- VS Code extension is TypeScript; entry point is `vscode-extension/src/extension.ts` and compiled output lives in `vscode-extension/dist` (do not edit dist files).
- Webview assets live in `vscode-extension/webview` and are built by the root `npm run frontend:build:vscode` script.
- Bundled backend binaries live in `vscode-extension/bin/<platform>` and are staged by the root `backend:stage:*` scripts or the extension `prepackage:*` scripts.
- Settings come from `.vscode/parallel-cli-runner.json` and VS Code configuration under `parallelCliRunner.*`.
- You can connect to an external backend by setting `PARALLEL_CLI_RUNNER_WS_URL` and `PARALLEL_CLI_RUNNER_AUTH_TOKEN`.
- Use `npm --prefix vscode-extension run compile` to build the extension and `npm --prefix vscode-extension run package:*` to produce a VSIX.
