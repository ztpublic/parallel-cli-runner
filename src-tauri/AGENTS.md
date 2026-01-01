# AGENTS.md

- Backend is Tauri (Rust).
- Entry points: `src-tauri/src/main.rs` and `src-tauri/src/lib.rs`.
- Core modules live in `src-tauri/src/*.rs` (PTY sessions in `pty.rs`, git operations in `git.rs`).
- Type exports are generated in `src-tauri/src/export_types.rs` and written to `src/types/git.ts` via `cargo test`.
- Tests live in `src-tauri/tests`.
- Use Cargo from `src-tauri/` for checks like `cargo test`.
