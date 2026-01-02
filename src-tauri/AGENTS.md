# AGENTS.md

- Backend is Tauri (Rust) plus a standalone WebSocket server mode for the VS Code extension.
- Entry points: `src-tauri/src/main.rs` (Tauri app or `--port`/`--auth-token` WS server) and `src-tauri/src/lib.rs`.
- Core modules live in `src-tauri/src/*.rs` (PTY sessions in `pty.rs`, git operations in `git.rs`, WS server in `ws_server.rs`).
- Type exports are generated in `src-tauri/src/export_types.rs` and written to `src/types/git.ts` via `cargo test`.
- Tests live in `src-tauri/tests`.
- Use Cargo from `src-tauri/` for checks like `cargo test` and release builds for extension packaging.
