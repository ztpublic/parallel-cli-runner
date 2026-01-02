# Platform Layer

Shared platform abstractions used by both Tauri and VSCode webviews.

- `src/platform/config.ts` reads the injected runtime config (`window.__APP_CONFIG__`).
- `src/platform/transport.ts` provides the WS transport with a Tauri fallback.
- `src/platform/actions.ts` wraps dialog/opener actions with WS routing or Tauri plugins.
- `src/platform/vscode.ts` provides a request bridge for VS Code webview-only APIs.
