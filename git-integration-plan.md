You already have “multi-terminal broadcast to multiple code agents”.
Now you want “Git brain” under that. Let’s design that as a separate layer and then wire it into your Tauri app.

I’ll assume:

* UI: Tauri + React/TS (`src`, `public`) ([GitHub][1])
* Backend: Rust via `src-tauri` that already manages PTYs for the terminals. ([GitHub][1])

Below is a concrete plan, in phases, with specific APIs and data structures.

---

## 0. Core decisions

### 0.1 How will you talk to Git?

**Option A – Shell out to `git` CLI (recommended first):**

* Pros: zero extra deps, matches user’s Git config exactly, easy to debug.
* Use *script-friendly* formats:

  * `git status --porcelain=v2 -b` (stable, parseable status + branch) ([git-scm.com][2])
  * `git diff --numstat`, `git log --pretty=format:...`, etc.
* This is what tools like VS Code do under the hood (mostly cloaked behind their Source Control view) ([code.visualstudio.com][3])

**Option B – Use libgit2 via `git2-rs`:**

* Rust bindings to libgit2 (`git2` crate) give you a typed API for repos, commits, branches, diffs, etc. ([GitHub][4])
* You can even turn off network features (`default-features = false`) if you’re local-only to reduce bloat. ([Zenn][5])

**Plan**:

> Start with *CLI* (fast to integrate, easy to reason about).
> Later, move hot paths (status/diff) to `git2` if needed.

---

## 1. Conceptual architecture

Add a **Git layer** that sits beside your terminal manager:

```text
+-----------------------------+      +-------------------------+
| React UI (panels, controls) | <--> | Tauri Commands (Rust)  |
+-----------------------------+      +-------------------------+
             |                                     |
             |                                     +-- GitService (new)
             |                                     |   - run_git(...)
             |                                     |   - status(), diff(), commit()...
             v
+-----------------------------+      +-------------------------+
| Terminal Manager            |      | Git layer (CLI / git2) |
| - PTYs per panel            |      | - Repo discovery       |
| - Broadcast input           |      | - Structured info      |
+-----------------------------+      +-------------------------+
```

Key idea: **terminals keep doing “dumb text”**; the **app** performs Git operations out-of-band and presents structured info.

---

## 2. Data model

Introduce a few core types (Rust and mirrored in TS):

```ts
type RepoId = string;  // e.g. canonicalized path to repo root

interface RepoStatus {
  repoId: RepoId;
  rootPath: string;
  branch: string;
  ahead: number;
  behind: number;
  hasUntracked: boolean;
  hasStaged: boolean;
  hasUnstaged: boolean;
  conflictedFiles: number;
  modifiedFiles: FileStatus[];
}

interface FileStatus {
  path: string;
  staged: "added" | "modified" | "deleted" | "renamed" | "unmerged" | null;
  unstaged: "added" | "modified" | "deleted" | "renamed" | "unmerged" | null;
}
```

And on the app side:

```ts
interface PanelSession {
  panelId: string;
  cwd: string;
  repoId?: RepoId;     // filled if cwd is inside a git repo
  lastStatus?: RepoStatus;
  agentId?: string;    // if you map panels <-> code agents
}
```

You maintain a map:

```ts
Map<PanelId, PanelSession>
Map<RepoId, RepoStatus>
```

---

## 3. GitService in Rust (backend)

### 3.1 A generic `run_git` helper

In `src-tauri`:

```rust
use std::{path::Path, process::Command};

#[derive(Debug)]
pub struct GitOutput {
    pub stdout: String,
    pub stderr: String,
}

#[derive(thiserror::Error, Debug)]
pub enum GitError {
    #[error("git not found")]
    GitNotFound,
    #[error("git failed: {stderr}")]
    GitFailed { code: Option<i32>, stderr: String },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("utf8 error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
}

pub fn run_git(cwd: &Path, args: &[&str]) -> Result<GitOutput, GitError> {
    let output = Command::new("git")
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                GitError::GitNotFound
            } else {
                e.into()
            }
        })?;

    if output.status.success() {
        Ok(GitOutput {
            stdout: String::from_utf8(output.stdout)?,
            stderr: String::from_utf8(output.stderr)?,
        })
    } else {
        Err(GitError::GitFailed {
            code: output.status.code(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}
```

Expose Tauri commands like:

```rust
#[tauri::command]
async fn git_detect_repo(cwd: String) -> Result<Option<String>, String> { /* ... */ }

#[tauri::command]
async fn git_status(cwd: String) -> Result<RepoStatusDto, String> { /* ... */ }

#[tauri::command]
async fn git_diff(cwd: String, pathspecs: Vec<String>) -> Result<String, String> { /* ... */ }

#[tauri::command]
async fn git_commit(
    cwd: String,
    message: String,
    stage_all: bool,
    amend: bool,
) -> Result<(), String> { /* ... */ }
```

### 3.2 Using script-friendly outputs

Use **porcelain** and custom formats instead of parsing human-oriented text:

* `git rev-parse --show-toplevel` to detect repo root.
* `git status --porcelain=v2 -b`

  * Lines starting with `# branch` give branch name and ahead/behind.
  * Lines starting with `1`, `2`, `u` give file statuses in a fixed layout. ([git-scm.com][6])
* `git diff --numstat` to get number of insertions/deletions per file.
* `git log --pretty=format:%H%x09%an%x09%ad%x09%s --date=iso-strict` for a simple commit list.

This keeps parsing robust and future-proof.

---

## 4. Integrating with panels & broadcast

### 4.1 Detect repo per panel

When a panel is created (you already know its `cwd`):

1. Call `git_detect_repo(cwd)` in the backend:

   * Internally: run `git rev-parse --show-toplevel` in that directory.
   * If success → return canonical repo root (string).
   * If failure → panel not in a repo.

2. Cache this `RepoId` in `PanelSession`.

3. In the UI, show a little pill in the panel tab:

```text
[ claude-agent-1 | branch: main ▲1 ▼0 ●3 ]
```

(●=dirty, maybe color-coded).

### 4.2 Status refresh triggers

Define a simple policy:

* Refresh status for a repo when:

  * A command finishes in *any* panel mapped to that repo (you already know when a PTY command exits).
  * User manually clicks a refresh icon.
  * Optional: on a low-frequency timer (e.g., every 10–20 seconds) while app is focused.

Implementation:

1. When a panel emits “command completed” (you already emit something to UI when a process returns exit code 0/non-0), fire `git_status` for its repo.
2. Merge the result into your `RepoStatus` cache and update any panel UI tied to that repo.

This way, your Git view stays roughly in sync without integrating with an editor or file watcher yet.

---

## 5. Multi-agent semantics using Git (worktrees/branches)

You’re literally building something in the same space as **Uzi**, which:

> runs multiple AI coding agents in parallel and uses automatic Git worktree management for isolated development. ([GitHub][7])

You can borrow the same idea.

### 5.1 “Agent session” model

Add a layer:

```ts
interface AgentSession {
  id: string;
  baseRepo: RepoId;
  baseBranch: string;    // e.g. "main"
  agentWorktrees: AgentWorktree[];
}

interface AgentWorktree {
  agentId: string;
  panelId: string;
  worktreePath: string;
  branchName: string;    // e.g. "agent/session-1/claude"
}
```

### 5.2 Creating a multi-agent session

Workflow:

1. User selects “Start multi-agent session” and a base repo path.

2. Backend:

   * Confirm repo is clean (optionally auto-commit or stash).
   * For each agent/panel:

     * Pick a branch: `agent/<session>/<agentName>`.
     * Run:
       `git worktree add ../<project>-agent-<n> <branch>`
       (If branch doesn’t exist, `git worktree add --detach` then create branch.)
   * Return the set of `worktreePath`s.

3. Frontend:

   * Spawn each terminal panel with `cwd = worktreePath`.
   * Attach `agentId` + `AgentSession` metadata.

Now each agent operates in its **own working copy**, and the Git layer knows exactly which branch/worktree each panel corresponds to.

### 5.3 Checkpoints & merge

Provide Git operations bound to agents:

* **Checkpoint agent**:

  * `git add -A`
  * `git commit -m "agent: <name> checkpoint <N>"` in that agent’s worktree.
* **Compare agents**:

  * Use `git diff agent/session-1/claude..agent/session-1/gpt` and show textual summary in a side panel.
* **Merge agent into main**:

  * Checkout main in base repo (or in a special “merge worktree”).
  * `git merge --no-ff agent/session-1/claude`
  * Present conflicts as raw diff or let users resolve in their editor, but your app can orchestrate commits.

This keeps a clean mental model: your terminal runner becomes an **orchestrator of multiple Git branches/worktrees per agent**, not just a dumb multi-PTY.

---

## 6. UI/UX for version control

Start simple; evolve later:

### 6.1 Per-panel header

* Branch chip: `main`, `feature/foo`, etc.
* Dirty indicator:

  * Gray if clean.
  * Yellow if untracked/unstaged.
  * Green outline when there are staged changes pending commit.
* Tooltip or small dropdown showing:

  * Ahead/behind counts (like `↑2 ↓1`).
  * Quick actions: “View status”, “Commit…”, “Discard changes…”.

### 6.2 Global “Version Control” sidebar

Like VS Code’s Source Control view ([code.visualstudio.com][3]), but tuned to your world:

* Tree of **Repos** currently in play.
* Under each repo:

  * `Working tree` sections:

    * Staged changes
    * Unstaged changes
    * Untracked files
  * Optional `Agents` subsection showing branches/worktrees per agent.

You don’t need a full diff viewer at first; just clicking a file can:

* open `git diff HEAD -- path` in a floating read-only terminal; or
* eventually, a nicer side-by-side diff.

### 6.3 Commit flow

Add a simple commit dialog:

1. User presses “Commit” from repo or panel header.
2. Dialog shows:

   * A text box for commit message.
   * A list of files with checkboxes (or just a “Stage all changes” option in v1).
3. On confirm:

   * Backend performs:

     * `git add` for checked files (or `-A`).
     * `git commit -m "<message>"` (with optional `--amend`).
   * Refresh status.

Broadcasting a literal `git commit` command through terminals is error-prone; this **centralized flow** is safer and normalized.

---

## 7. Safety & recovery

Because you are orchestrating *multiple* agents and repos, you want a couple of guard rails:

* **Dry runs before destructive actions**:

  * For things like `git reset --hard`, show a preview (“These files will be discarded”) by comparing current status vs HEAD.
* **Automatic snapshots**:

  * Optionally, before operations like “reset all agent worktrees”, automatically create a lightweight branch or tag (`checkpoint/<timestamp>`) so people can recover.

---

## 8. Implementation phases

### Phase 1 – Minimal Git awareness

* Implement `run_git` helper.
* Commands:

  * `git_detect_repo(cwd) -> Option<RepoRoot>`
  * `git_status(cwd) -> RepoStatusDto`
* Frontend:

  * Attach `repoId` to each panel.
  * Show branch + dirty indicator in panel header.
  * Refresh status when commands finish.

### Phase 2 – Structured commands & UI

* Add:

  * `git_diff(cwd, files?) -> string`
  * `git_commit(cwd, message, stage_all, amend)`
  * `git_switch_branch(cwd, branch, create_if_missing?)`
* Frontend:

  * Simple “Version Control” sidebar showing:

    * File list split into staged/unstaged/untracked.
  * Commit dialog.

### Phase 3 – Agent sessions (worktrees/branches)

* Backend:

  * `create_agent_session(base_repo_root, agents: AgentConfig[]) -> AgentSessionDto`

    * Creates branches and worktrees as described.
  * `checkpoint_agent(agentWorktreePath, message?)`
* Frontend:

  * Wizard for starting a multi-agent session (choose repo + agents).
  * Panels are launched into their own worktrees.
  * Buttons: “Checkpoint <agent>”, “Compare agents”.

### Phase 4 – Advanced features

* Push / pull / fetch support (later, when you’re ready to deal with auth and remotes).
* Optional `git2-rs` migration for:

  * Faster diffs.
  * Richer metadata (blame, commit graph visualization).
* Integration with editors:

  * For example, if you later embed a file viewer, you can show inline blame and diff.

---

## 9. Practical notes

* **Git presence**: On startup, detect whether `git` is in PATH and show a warning in settings if not.
* **Cross-platform**: Your Tauri backend already abstracts most OS differences; just be careful with path handling (use `PathBuf`, not string hacks).
* **Error surfacing**: For failing Git commands, propagate stderr nicely to the UI so users can see *why* it failed (e.g., unmerged files, etc.).

---

If you’d like, next step I can:

* Sketch the exact `RepoStatusDto` and `AgentSessionDto` types for both Rust and TS, or
* Draft the Tauri command definitions + a tiny React hook like `useRepoStatus(panelId)` that wires all this together.

[1]: https://github.com/ztpublic/parallel-cli-runner "GitHub - ztpublic/parallel-cli-runner"
[2]: https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain?utm_source=chatgpt.com "10.1 Git Internals - Plumbing and Porcelain"
[3]: https://code.visualstudio.com/docs/sourcecontrol/overview?utm_source=chatgpt.com "Source Control in VS Code"
[4]: https://github.com/rust-lang/git2-rs?utm_source=chatgpt.com "rust-lang/git2-rs: libgit2 bindings for Rust"
[5]: https://zenn.dev/kyoheiu/articles/7268850f3df2e8?utm_source=chatgpt.com "Rustで疑似マイクロサービスを動かす体験がすごくよい - libgit2編"
[6]: https://git-scm.com/docs/git?utm_source=chatgpt.com "Git - git Documentation"
[7]: https://github.com/devflowinc/uzi?utm_source=chatgpt.com "devflowinc/uzi: CLI for running large numbers of coding ..."
