This plan updates the ACP client integration to match how this repo actually works: a Rust backend that runs either as a Tauri app (with an embedded WS server) or as a standalone WS server for the VS Code extension. The frontend always talks over the shared WS request/response/event contract defined in `docs/vscode-integration/ws-transport-contract.md`.

Key repo realities to align with:

- Backend lives in `src-tauri/` and already exposes a WS request/response API plus events (`session-data`, `scan-progress`).
- Both the Tauri app and VS Code webview use the same WS contract via `src/platform/transport.ts`.
- UI config is injected through `window.__APP_CONFIG__` (wsUrl, authToken, settings, workspacePath).
- There is already PTY session infrastructure in `src-tauri/src/pty.rs` and a WS server in `src-tauri/src/ws_server.rs`.

---

## Phase 0 - Define ACP integration boundaries in this repo

1) Decide where ACP lives and how it is exposed

- ACP client code should live in `src-tauri/src/acp/` so both Tauri and WS server modes can use it.
- Expose ACP operations through the existing WS contract (same request/response/event envelope used for git + PTY).
- Keep any new request/response methods in `ws_server.rs` and mirror them in the contract docs.

2) Add a minimal ACP module layout (Rust)

- `src-tauri/src/acp/mod.rs` - public API (manager + request helpers).
- `src-tauri/src/acp/runtime.rs` - stdio transport + ACP connection lifecycle.
- `src-tauri/src/acp/agent_catalog.rs` - optional: loading agent configs.
- `src-tauri/src/acp/types.rs` - DTOs and ts-rs exports for UI.

Deliverable: a short ACP architecture note describing how ACP runtime connects to the WS contract.

---

## Phase 1 - ACP runtime in the Rust backend (stdio-first)

3) Implement stdio transport consistent with ACP

- Spawn agent subprocesses (command/args/env/cwd from config).
- Encode/decode JSON-RPC 2.0 with newline-delimited frames (no embedded newlines).
- Route agent stderr to logs only (never to ACP stdout).

4) Build the ACP connection manager

- Use the existing `agent-client-protocol` crate already in `src-tauri/Cargo.toml`.
- Add an `AcpManager` similar to `PtyManager`: tracks agent processes + sessions.
- Maintain a per-connection lifecycle state: Created -> Initialized -> Ready -> Closed.
- Fail fast if protocol version negotiation fails during `initialize`.

Deliverable: `AcpManager` can connect to one agent and report initialization success/failure.

---

## Phase 2 - Expose ACP through the WS transport contract

5) Add WS methods in `src-tauri/src/ws_server.rs`

Suggested method names (match existing `git_*` + `create_session` naming style):

- `acp_connect` (params: agent config) -> connection id
- `acp_disconnect` (params: connection id) -> void
- `acp_session_new` (params: connection id + cwd + optional mcpServers) -> session id
- `acp_session_load` (optional, if agent supports it)
- `acp_session_prompt` (params: session id + content blocks) -> void
- `acp_session_cancel` -> void
- `acp_permission_reply` (params: request id + decision) -> void

6) Add WS events for ACP streaming

Suggested event names (consistent with existing `session-data` and `scan-progress`):

- `acp-session-update` (streaming response chunks + status)
- `acp-session-state` (ready/closed/error)
- `acp-permission-request` (request id + description + options)
- `acp-terminal-output` (if ACP terminal hooks are enabled)

7) Update WS transport documentation

- Add the new methods + events to `docs/vscode-integration/ws-transport-contract.md`.
- Keep method signatures and payload shapes in sync with `src/platform` service code.

Deliverable: ACP operations are reachable from the frontend via the same WS contract used elsewhere.

---

## Phase 3 - Frontend service + UI integration

8) Add a frontend ACP service layer

- Create `src/services/acp.ts` or `src/services/agents.ts` to wrap `getTransport().request()`.
- Subscribe to ACP events using `getTransport().subscribe()` for streaming output and permission prompts.
- Export typed DTOs in `src/types/acp.ts` using `ts-rs` (mirror `src-tauri/src/export_types.rs`).

9) Add ACP session UI wiring

- Use the existing ACP placeholder in `src/components/TerminalPanel.tsx` as the entry point.
- Introduce an ACP session view component and state hook (e.g., `src/hooks/useAcpSessions.ts`).
- Optionally pull reference UI pieces from `ai-elements-fork/` for the chat layout and tool approval flows.

10) Keep browser dev mode working

- Extend `src/mocks/tauri.ts` to mock ACP methods/events used in UI (for `npm run dev:browser`).

Deliverable: ACP sessions can be created from the UI and stream updates in the chat view.

---

## Phase 4 - Permissions + tools (aligned to existing backend capabilities)

11) Permission broker implementation

- Implement `Client::request_permission` in the ACP client (required by the crate).
- Forward permission requests to the UI via `acp-permission-request` and resolve via `acp_permission_reply`.
- Enforce workspace boundaries using `window.__APP_CONFIG__.workspacePath` (when present).

12) Filesystem + terminal hooks

- If you advertise filesystem capabilities, wire them to new safe wrappers in `src-tauri/src/acp/`.
- For terminal capabilities, reuse `PtyManager` where possible to avoid duplicate PTY handling.
- Gate high-risk operations through the permission broker by default.

Deliverable: ACP agents can request file/terminal actions with explicit user approval.

---

## Phase 5 - Agent catalog + configuration

13) Start with a simple config-driven catalog

- Add agent definitions to settings (e.g., `settings.acpAgents`) that are already injected into `window.__APP_CONFIG__`.
- For VS Code, reuse `.vscode/parallel-cli-runner.json` or VS Code settings to define agent configs.

14) Optional: support `agent.json` manifests later

- Parse manifests if present, but keep the MVP catalog in settings first.

Deliverable: users can add ACP agents without new backend code.

---

## Phase 6 - Testing + stability

15) Backend tests

- Add an in-process fake ACP agent in `src-tauri/tests` to cover initialize + session prompt + updates.
- Add a smoke test for WS methods to ensure request/response shapes stay valid.

16) Frontend smoke coverage

- Add Storybook stories for ACP chat + permission flows using `ai-elements-fork` components.
- Keep `dev:browser` mocks in sync to avoid UI regressions.

Deliverable: ACP flows are covered by basic automated tests and stories.

---

## Practical vertical slice (fastest route)

1) ACP stdio runtime + `acp_connect`
2) `acp_session_new` + `acp_session_prompt` + `acp-session-update` event
3) Basic ACP chat view in the ACP tab
4) Permission flow wiring (`request_permission` + UI prompt + `acp_permission_reply`)

---

Reference material:
- `docs/vscode-integration/ws-transport-contract.md`
- `src-tauri/src/ws_server.rs`
- `src/platform/transport.ts`
- ACP protocol docs: https://agentclientprotocol.com/
