# Refactor TODO List

## High Priority (Bug Fixes & Stability)

- [x] **Fix Split Multi-byte Character Handling in PTY Reader**
    - **Location:** `src-tauri/src/lib.rs` -> `spawn_reader_loop`
    - **Issue:** Reading into a fixed-size buffer (`[0u8; 2048]`) and immediately converting with `String::from_utf8_lossy` will corrupt multi-byte characters that happen to be split across two buffer reads.
    - **Fix:** Use a streaming UTF-8 decoder (e.g., `termwiz`, `utf8parse`, or manually buffering incomplete bytes).

- [ ] **Robust Error Handling in `PtyManager`**
    - **Location:** `src-tauri/src/lib.rs`
    - **Issue:** Uses `expect("poisoned")` on Mutex locks. While standard for simple apps, a panic in one thread (e.g., during a resize) could poison the lock and crash the whole app.
    - **Fix:** Handle `PoisonError` gracefully or use `parking_lot` Mutexes which don't poison (if appropriate for the consistency model), or ensure all critical sections are panic-free.

## Medium Priority (Architecture & Performance)

- [ ] **Modularize `lib.rs`**
    - **Location:** `src-tauri/src/lib.rs`
    - **Issue:** The file contains the `PtyManager`, `PtySession`, `spawn_reader_loop`, and all Tauri commands.
    - **Refactor:**
        - Move `PtyManager` and `PtySession` to a new module `src-tauri/src/pty.rs`.
        - Keep `lib.rs` focused on Tauri command registration and app setup.

- [ ] **Optimize Git Repository Detection**
    - **Location:** `src-tauri/src/git.rs` -> `ensure_repo`
    - **Issue:** Almost every git command calls `detect_repo` (which runs `git rev-parse`) to verify the cwd is a repo. This doubles the process spawning for every operation.
    - **Refactor:** Pass the known `repo_root` from the frontend where possible, or cache valid repo paths (with invalidation).

- [ ] **Optimize Agent Loading**
    - **Location:** `src-tauri/src/agent.rs` -> `load_repo_agents`
    - **Issue:** Reads directory and parses JSON files on every call.
    - **Refactor:** Implement a caching mechanism in `AgentManager` that only re-reads from disk if the directory mtime changes or via an explicit refresh command.

- [ ] **Consolidate Git Command Execution**
    - **Location:** `src-tauri/src/git.rs`
    - **Issue:** `run_git` manually handles `Command` creation.
    - **Refactor:** Create a `GitCommandBuilder` to standardize `cwd`, `env` (e.g., `LC_ALL=C`), and error mapping.

## Low Priority (Polish & Maintainability)

- [ ] **Configuration for Shell and Tools**
    - **Location:** `src-tauri/src/lib.rs` (`default_shell`) and `src-tauri/src/git.rs` (`resolve_difftool_tool`)
    - **Issue:** Shell defaults and diff tools are hardcoded or rely on specific env vars.
    - **Refactor:** Introduce a user configuration file (e.g., `~/.parallel-cli-config.json` or standard Tauri config store) to allow users to customize their shell, terminal colors, and diff tools.

- [ ] **Automated Type Synchronization**
    - **Location:** `src-tauri/src/*.rs` vs `src/types/*.ts`
    - **Issue:** Types are manually synchronized.
    - **Refactor:** Investigate `ts-rs` or `tauri-specta` to automatically generate TypeScript definitions from Rust structs.

- [ ] **Add Unit Tests**
    - **Location:** `src-tauri/src/lib.rs`, `src-tauri/src/agent.rs`
    - **Task:** Add unit tests for `AgentManager` logic (mocking the filesystem) and `PtyManager` (if possible, or integration tests).

## Frontend Improvements

- [ ] **Strict Typing for Service Layer**
    - **Location:** `src/services/tauri.ts`
    - **Task:** Ensure all `invoke` calls have explicit generic types for return values (mostly done, but review required).

- [ ] **Error Boundary**
    - **Location:** `src/App.tsx`
    - **Task:** Wrap the main application or key components in a React Error Boundary to catch render errors gracefully, especially since we are dealing with complex layout recursion.
