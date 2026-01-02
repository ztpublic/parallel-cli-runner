# VSCode Extension Integration Plan

## Evaluation of the idea

Your goal is feasible and can be done cleanly, but there are a few hard constraints to plan around:

- **Webview transport:** VSCode webviews can only talk to the extension host via `postMessage`, but they can also connect to a local WebSocket server. If you want to avoid `postMessage`, the practical option is to run the Rust backend as a local WS server and have the webview connect directly.
- **Tauri APIs are not available:** Any frontend code that depends on Tauri (`@tauri-apps/api`, `invoke`, filesystem/OS APIs, window APIs) will not work in VSCode. You will need a transport and platform abstraction layer.
- **Native binary distribution:** VSCode extensions can ship native binaries, but you must package per-OS (and often per-arch) bundles. This is manageable but adds CI/build complexity.
- **Security and CSP:** Webviews have strict CSP. You must explicitly allow `connect-src` for `ws://127.0.0.1:<port>`, and keep auth scoped to `127.0.0.1` with a per-session token.
- **Remote scenarios:** VSCode Remote (SSH/Codespaces) is intentionally out of scope, so you can assume localhost connectivity from the webview.

Overall: the idea is sound **if you commit to a shared transport (WS-only) and a small platform layer** so the React UI can run in both Tauri and VSCode. The Rust backend-as-binary is a strong fit for VSCode, but you must handle packaging and lifecycle carefully.

---

## Decisions locked in

- **Feature parity:** all features must be available in the extension; each feature is implemented in the Rust backend or routed to the extension host for handling.
- **Transport:** WebSocket-only for all request/response and events (no HTTP endpoints).
- **Backend lifecycle (VSCode):** start on extension activation, stop on deactivate; one backend process per VSCode window.
- **Port strategy:** one port per window; pick an ephemeral port on activation and reuse for all webviews in that window.
- **Auth token policy:** generate a random token per activation, pass via WS query string (e.g., `?token=`), store in memory only, no rotation, reject unauthenticated connections.
- **Config handoff:** prefer a JSON config file with the same shape as VSCode settings so it can be converted/merged; extension reads file and overlays with VSCode settings.
- **Target platforms:** ship Windows x64 and macOS arm64 only; ignore other platforms.

## Step-by-step integration plan

### Phase 0: Discovery and constraints
1. **Inventory Tauri dependencies** used by the React app (APIs, file access, window management, IPC). Map each feature to a Rust backend implementation or an extension-host bridge (no exclusions).
2. **Define the shared transport contract** (request/response shape, message IDs, streaming needs, events, error model, versioning) for WebSocket-only.
3. **Confirm remote support is out of scope** so URL generation and CSP can assume local desktop only.

### Phase 1: Create a shared transport layer
4. **Add a frontend transport abstraction** (e.g., `src/platform/transport.ts`) with a concrete `WsTransport` implementation (request/response + events).
5. **Refactor frontend calls** to use the transport abstraction instead of Tauri `invoke`.
6. **Add a platform config provider** that exposes `wsUrl`, `authToken`, and app settings at runtime. In Tauri, inject from Rust; in VSCode, load from config file + settings and inject into the webview HTML.

### Phase 2: Rust backend serverization
7. **Extract backend core** into a reusable Rust crate if the Tauri backend has UI-coupled code.
8. **Add a WebSocket server layer** in Rust that exposes the same commands/events your frontend expects.
9. **Add a `--port` and `--auth-token` CLI interface** to the Rust binary so the VSCode extension can spawn it deterministically.
10. **Bind to `127.0.0.1` only** and reject WS connections without the auth token.

### Phase 3: Tauri compatibility
11. **Run the Rust WS server inside Tauri** (background task or sidecar) and point the Tauri webview frontend at `ws://127.0.0.1:<port>`.
12. **Update Tauri CSP/permissions** to allow `connect-src` to `ws://127.0.0.1:<port>`.
13. **Remove direct `invoke` usage** after migration (allow a short-lived fallback only if needed).

### Phase 4: VSCode extension scaffold
14. **Create a new `vscode-extension/` folder** with a standard extension scaffold (`package.json`, `src/extension.ts`, `tsconfig.json`).
15. **Implement a webview panel** that serves the React build output and injects a runtime config object (WS URL + auth token + settings).
16. **Define a config file format** (e.g., `.vscode/parallel-cli-runner.json`) that mirrors the VSCode settings schema; load/merge it with VSCode settings.
17. **Set a strict CSP** with `connect-src` limited to `ws://127.0.0.1:<port>`.

### Phase 5: Build and bundle the frontend for webview
18. **Add a Vite build target** for VSCode webview with:
    - `base` set for `webview.asWebviewUri`
    - CSP-safe inline policies (no `eval`, no remote scripts)
    - runtime config injection (e.g., `window.__APP_CONFIG__`)
19. **Update extension HTML template** to reference built assets via `webview.asWebviewUri`.

### Phase 6: Bundle the Rust binary
20. **Build Rust binaries** for Windows x64 and macOS arm64 only.
21. **Place binaries in the extension** under `vscode-extension/bin/<platform>/<binary>` and add them to `package.json` `files`.
22. **At runtime, spawn the correct binary** based on `os.platform()` and `os.arch()`, and error on unsupported platforms.

### Phase 7: Lifecycle + health checks
23. **Implement backend lifecycle tied to extension lifecycle** (start on activate, stop on deactivate), one backend process per VSCode window.
24. **Pick an ephemeral port per window**, reuse it for all webviews in that window, and retry on collisions.
25. **Add WS health checks** (handshake ack or ping/pong) and retry logic before loading the UI.
26. **Expose logs** from the Rust process to the VSCode output channel for debugging.

### Phase 8: Packaging and distribution
27. **Add build scripts** to create:
    - `frontend:build:vscode` (Vite)
    - `backend:build:win-x64` / `backend:build:mac-arm64` (Cargo)
    - `extension:package:<platform>` (vsce)
28. **Set up CI** to build and publish per-platform VSIX packages with bundled binaries.

### Phase 9: Validation and QA
29. **Desktop smoke test**: run VSCode, open the extension webview, verify backend connectivity and feature parity.
30. **Offline test**: ensure no network calls are required except localhost.

### Phase 10: Documentation
31. **Add developer docs** describing:
    - How to build and run the extension locally
    - How to build platform binaries
    - Known differences between Tauri and VSCode runtime
