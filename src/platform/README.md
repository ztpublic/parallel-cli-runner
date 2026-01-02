# Platform Layer

Shared platform abstractions used by both the Tauri desktop app and the VS Code webview.

- `src/platform/config.ts` reads the injected runtime config (`window.__APP_CONFIG__`) from Tauri or the extension.
- `src/platform/transport.ts` chooses WebSocket transport when `wsUrl` is present, otherwise uses Tauri invoke/listen.
- `src/platform/actions.ts` routes dialogs/openers to the VS Code bridge, WebSocket backend, or Tauri plugins.
- `src/platform/vscode.ts` provides a request/response bridge for VS Code webview-only APIs.
