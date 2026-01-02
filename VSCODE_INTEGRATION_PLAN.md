# VSCode Extension Integration Plan

## Evaluation of the idea

Your goal is feasible and can be done cleanly, but there are a few hard constraints to plan around:

- **Webview transport:** VSCode webviews can only talk to the extension host via `postMessage`, but they can also talk to a local HTTP/WebSocket server. If you want to avoid `postMessage`, the practical option is to run the Rust backend as a local server and have the webview use `fetch`/`WebSocket` directly.
- **Tauri APIs are not available:** Any frontend code that depends on Tauri (`@tauri-apps/api`, `invoke`, filesystem/OS APIs, window APIs) will not work in VSCode. You will need a transport and platform abstraction layer.
- **Native binary distribution:** VSCode extensions can ship native binaries, but you must package per-OS (and often per-arch) bundles. This is manageable but adds CI/build complexity.
- **Security and CSP:** Webviews have strict CSP. You must explicitly allow `connect-src` for `http://127.0.0.1:<port>` and `ws://127.0.0.1:<port>`, and keep auth scoped to `127.0.0.1` with a per-session token.
- **Remote scenarios:** In VSCode Remote (SSH/Codespaces), a local port might not be reachable by the webview without `vscode.env.asExternalUri`. If remote support is needed, plan for it now.

Overall: the idea is sound **if you commit to a shared transport (HTTP/WS) and a small platform layer** so the React UI can run in both Tauri and VSCode. The Rust backend-as-binary is a strong fit for VSCode, but you must handle packaging and lifecycle carefully.

---

## Step-by-step integration plan

### Phase 0: Discovery and constraints
1. **Inventory Tauri dependencies** used by the React app (APIs, file access, window management, IPC). Decide which must be supported in VSCode and which are Tauri-only.
2. **Define the shared transport contract** (request/response shape, streaming needs, events). Decide on HTTP + WebSocket (recommended) or pure WebSocket.
3. **Decide on remote support** (local desktop only vs. VSCode Remote). This affects URL generation and CSP.

### Phase 1: Create a shared transport layer
4. **Add a frontend transport abstraction** (e.g., `src/platform/transport.ts`) with a concrete `HttpTransport`/`WsTransport` implementation.
5. **Refactor frontend calls** to use the transport abstraction instead of Tauri `invoke`.
6. **Add a platform config provider** that exposes `backendUrl` and `authToken` at runtime. In Tauri, this can be injected from the Rust side or via a local server; in VSCode, it will be injected into the webview HTML.

### Phase 2: Rust backend serverization
7. **Extract backend core** into a reusable Rust crate if the Tauri backend has UI-coupled code.
8. **Add an HTTP/WS server layer** in Rust that exposes the same commands/events your frontend expects.
9. **Add a `--port` and `--auth-token` CLI interface** to the Rust binary so the VSCode extension can spawn it deterministically.
10. **Bind to `127.0.0.1` only** and reject requests without the auth token.

### Phase 3: Tauri compatibility
11. **Run the Rust server inside Tauri** (background task or sidecar) and point the Tauri webview frontend at `http://127.0.0.1:<port>`.
12. **Update Tauri CSP/permissions** to allow `connect-src` to localhost and `ws://` for the chosen port.
13. **Remove direct `invoke` usage** or keep it behind a debug-only transport for local development.

### Phase 4: VSCode extension scaffold
14. **Create a new `vscode-extension/` folder** with a standard extension scaffold (`package.json`, `src/extension.ts`, `tsconfig.json`).
15. **Implement a webview panel** that serves the React build output and injects a runtime config object (backend URL + auth token).
16. **Set a strict CSP** with `connect-src` limited to `http://127.0.0.1:<port>` and `ws://127.0.0.1:<port>`.

### Phase 5: Build and bundle the frontend for webview
17. **Add a Vite build target** for VSCode webview with:
    - `base` set for `webview.asWebviewUri`
    - CSP-safe inline policies (no `eval`, no remote scripts)
    - runtime config injection (e.g., `window.__APP_CONFIG__`)
18. **Update extension HTML template** to reference built assets via `webview.asWebviewUri`.

### Phase 6: Bundle the Rust binary
19. **Build Rust binaries per target** (macOS, Windows, Linux; arm/x64 as needed).
20. **Place binaries in the extension** under `vscode-extension/bin/<platform>/<binary>` and add them to `package.json` `files`.
21. **At runtime, spawn the correct binary** based on `os.platform()` and `os.arch()`.

### Phase 7: Lifecycle + health checks
22. **Implement backend process lifecycle** (start on webview open, stop on dispose).
23. **Add health checks** (HTTP `/health` or WS ping) and retry logic before loading the UI.
24. **Expose logs** from the Rust process to the VSCode output channel for debugging.

### Phase 8: Packaging and distribution
25. **Add build scripts** to create:
    - `frontend:build:vscode` (Vite)
    - `backend:build:<platform>` (Cargo)
    - `extension:package:<platform>` (vsce)
26. **Set up CI** to build and publish per-platform VSIX packages with bundled binaries.

### Phase 9: Validation and QA
27. **Desktop smoke test**: run VSCode, open the extension webview, verify backend connectivity and feature parity.
28. **Offline test**: ensure no network calls are required except localhost.
29. **Remote test (if supported)**: VSCode Remote + port forwarding (use `vscode.env.asExternalUri`).

### Phase 10: Documentation
30. **Add developer docs** describing:
    - How to build and run the extension locally
    - How to build platform binaries
    - Known differences between Tauri and VSCode runtime

---

## Recommended next decisions

1. Confirm whether VSCode Remote support is required. This impacts URL generation and CSP.
2. Decide whether to keep Tauri `invoke` as a secondary transport for local dev, or fully migrate to HTTP/WS.
3. Decide on a preferred folder for the extension (I suggested `vscode-extension/`).
