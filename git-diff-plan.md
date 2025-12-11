Here’s a compact, “use `git difftool` only” plan for the feature.

---

## 1. Define comparison scenarios

You need two primitives:

1. **Worktree vs main**

   * Compare an agent’s worktree branch with the base branch (e.g. `main`).

2. **Worktree vs worktree**

   * Compare two agent branches with each other.

Both will be implemented as:

```bash
git difftool <refA> <refB> [-- path/to/file]
```

which launches the user’s configured visual diff tool. `git difftool` is the standard Git mechanism for opening external diff tools.

---

## 2. Backend commands (Tauri / Rust side)

Implement minimal Tauri commands that just execute `git difftool`:

```rust
#[tauri::command]
async fn open_diff_between_refs(
    repo_root: String,
    ref_a: String,
    ref_b: String,
    path: Option<String>,   // optional file path
) -> Result<(), String> {
    let mut cmd = std::process::Command::new("git");
    cmd.current_dir(&repo_root)
        .arg("difftool")
        .arg(&ref_a)
        .arg(&ref_b);

    if let Some(p) = path {
        cmd.arg("--").arg(p);
    }

    let status = cmd.status().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("git difftool exited with {:?}", status.code()))
    }
}
```

Usage patterns:

* Worktree vs main: `open_diff_between_refs(repoRoot, "main", agentBranch, None)`
* Worktree vs worktree: `open_diff_between_refs(repoRoot, branchA, branchB, None)`
* Per-file diff: pass `Some("src/foo.rs".into())`.

You don’t parse diff output at all; the external tool UI does everything.

---

## 3. Frontend integration

In your React UI:

1. **Session overview / panel header**

   * For each agent / worktree add:

     * “Compare with main” button → calls `open_diff_between_refs(repoRoot, baseBranch, agentBranch, null)`.

2. **Between agents**

   * When viewing a TaskSession with multiple agents:

     * For each pair (or specifically “Compare to X” button) → call `open_diff_between_refs(repoRoot, branchA, branchB, null)`.

3. **File-level actions (optional)**

   * If you already list changed files per worktree:

     * For each file row, add:

       * “External diff (with main)” → `open_diff_between_refs(repoRoot, baseBranch, agentBranch, filePath)`.

No in-app diff UI is required; clicking a button simply opens the configured difftool (VS Code, Meld, Beyond Compare, etc.).

---

## 4. Configuration & UX details

1. **Rely on user’s Git difftool config**

   Tell users they can set their preferred tool with standard Git config, e.g.:

   ```bash
   git config --global diff.tool vscode
   git config --global difftool.vscode.cmd 'code --wait --diff "$LOCAL" "$REMOTE"'
   ```

   Once configured, `git difftool` always opens that tool.

2. **Failure handling**

   * If `git difftool` is not configured or not found:

     * Surface stderr and show a helpful message:

       * “Please configure a Git difftool (e.g. VS Code, Meld) using `git config`.”
   * If Git itself is missing, show: “Git not found in PATH; diffs unavailable.”

3. **Non-blocking UX**

   `git difftool` spawns a GUI process and exits when the tool closes (if `--wait` is used in the user’s config). Your backend can:

   * Fire-and-forget; no need to wait in UI.
   * Optionally just show a toast: “Opening diff in external tool…”

---

## 5. Scope boundary

* Your app is responsible for:

  * Deciding **which refs** to compare (`main` vs `parallel/task-…/agentX`, etc.).
  * Invoking `git difftool` with correct arguments.
* The external tool is responsible for:

  * Rendering side-by-side diffs, navigation, etc.

This keeps your implementation very small while still providing powerful, familiar diff UI to the user.
