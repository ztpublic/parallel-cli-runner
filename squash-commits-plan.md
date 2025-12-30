To implement “squash selected commit range” **without spawning `git rebase -i`**, you essentially need to **programmatically run a rebase** and **override the todo list** so that:

* the **first** selected commit is `pick`
* the **rest** of the selected commits are `squash` (or `fixup`)
* everything outside the selected range remains `pick`

libgit2 (and thus `git2` for Rust) has a rebase API that models this. `Repository::rebase(branch, upstream, onto, opts)` takes **annotated commits** and returns a `Rebase` iterator you can step through and commit. ([docs.rs][1])
It also supports an **in-memory** mode so you don’t touch the user’s working directory. ([docs.rs][2])

The main catch: **`git2` does not expose a safe “edit rebase operation kind” setter** today (it exposes reading operation `id()` etc.). ([docs.rs][3])
So you either:

1. add a small patch/fork to `git2` (recommended for a GUI), or
2. drop to `libgit2-sys` for just the “edit todo list” part, or
3. implement a custom replay (cherry-pick + amend) instead of using the rebase todo list.

Below is the approach that stays closest to interactive rebase semantics.

---

## 1) Translate “selected range” into an interactive rebase plan

Assume the user selects a **contiguous linear range** on the current branch:

```
base -> C1 -> C2 -> C3 -> C4 -> ... -> HEAD
        ^selected start      ^selected end
```

Equivalent CLI is: `git rebase -i <base>` (where `<base>` is **parent of C1**) and then marking `C2..Ck` as `squash`.

### Validation rules (strongly recommended)

* Reject if any selected commit is a **merge commit** (or decide on a separate “rebase --rebase-merges” path; classic rebase drops merges by default). ([git-scm.com][4])
* Reject if the selection isn’t on a **single first-parent chain** (i.e., not a simple linear segment).
* Warn if the branch is published / has upstream: you are rewriting history.

---

## 2) Start an in-memory rebase with `git2`

Core API surface you’ll use:

* `Repository::rebase(...) -> Rebase` ([docs.rs][1])
* `Rebase::next()` applies the patch for the next operation; conflicts may appear. ([docs.rs][5])
* `Rebase::commit(...)` creates each rebased commit. ([docs.rs][6])
* `Rebase::finish(...)` completes the rebase. ([libgit2.org][7])

And you’ll build inputs using **AnnotatedCommit** (because libgit2 wants “intent/context”). ([docs.rs][8])

Pseudocode for init:

```rust
let head_ref = repo.head()?.resolve()?; // ensure a direct ref
let branch = repo.reference_to_annotated_commit(&head_ref)?;

let base_oid = parent_of(selected_start)?;
let upstream = repo.find_annotated_commit(base_oid)?;

let mut opts = git2::RebaseOptions::new();
opts.inmemory(true); // don’t touch workdir :contentReference[oaicite:9]{index=9}

let mut rebase = repo.rebase(Some(&branch), Some(&upstream), None, Some(&mut opts))?;
```

---

## 3) Rewrite the rebase “todo” to mark squash/fixup

libgit2’s rebase operations support kinds including **Pick / Squash / Fixup / Reword / Edit / Exec**. ([libgit2.org][9])

### Practical recommendation for a GUI

* Offer two UX options:

  * **Squash** (combine messages)
  * **Fixup** (keep the first commit message)
* Optionally offer **Reword** of the resulting squashed commit message.

### How to implement the mutation

Because `git2` doesn’t expose “set operation kind”, you typically do one of:

#### Option A (recommended): fork/patch `git2` to expose a safe setter

Add something like:

* `Rebase::operation_byindex_mut(i) -> &mut raw::git_rebase_operation`
* or `RebaseOperation::set_kind(RebaseOperationType)`

This is the cleanest long-term for a Git GUI.

#### Option B: use `libgit2-sys` for this one step (unsafe but contained)

You can:

* iterate operations (by index),
* check `op.id()` to see if it’s in the selected set,
* then set the underlying `git_rebase_operation.kind = SQUASH/FIXUP`.

(Implementation details depend on how you access the underlying raw pointers; keeping this in a single “unsafe shim” module is the maintainable approach.)

---

## 4) Execute the rebase and create commits

The typical loop:

```rust
let committer = repo.signature()?; // uses repo config :contentReference[oaicite:11]{index=11}
let mut last_rewritten: Option<Oid> = None;

while let Some(step) = rebase.next() {
    let _op = step?;         // applies patch; may produce conflicts
    // If conflicts: either resolve programmatically (hard) or abort/fallback.

    // For “pick” you can pass None to keep original author+message.
    // For “squash/fixup” you often pass an explicit message you computed for the final squashed commit.
    let new_id = rebase.commit(None, &committer, None)?;
    last_rewritten = Some(new_id);
}

rebase.finish(Some(&committer))?;
```

### Conflicts in in-memory mode

In-memory rebases do not update the working directory, but you can access the produced index via `Rebase::inmemory_index()` for conflict inspection/resolution. ([docs.rs][5])
Most GUIs **fall back to running the rebase in an isolated worktree** if conflicts occur, because that enables normal file-based conflict resolution UX.

---

## 5) Update the branch ref to the new tip

With libgit2 rebases (especially in in-memory style), you may finish with `HEAD` not pointing where you expect unless you explicitly update the branch reference to the last rewritten commit. This is a known gotcha; the common fix is “set the branch ref target to the final rebase OID.” ([Stack Overflow][10])

So after your loop, take `last_rewritten` and:

* update the branch reference to point at it
* ensure `HEAD` is attached to that branch ref

(Do this as a transactional ref update if you want robustness.)

---

## Practical product guidance for your GUI

1. **Run history-rewrites in an isolated worktree** whenever possible (you already have a multi-worktree architecture). That gives you:

   * conflict resolution UX
   * no interference with user’s “main” checkout
   * an easy rollback story (delete the worktree branch)

2. Treat “squash” as a **high-risk operation**:

   * require clean state (or auto-stash)
   * show a clear warning about force-push if upstream exists

3. Start with the constrained case:

   * linear selection
   * no merges
   * no conflicts (abort on conflict, with a “retry in isolated worktree” button)

---


[1]: https://docs.rs/git2/latest/git2/struct.Repository.html "Repository in git2 - Rust"
[2]: https://docs.rs/git2/latest/git2/struct.RebaseOptions.html?utm_source=chatgpt.com "RebaseOptions in git2 - Rust"
[3]: https://docs.rs/git2/latest/git2/struct.RebaseOperation.html?utm_source=chatgpt.com "RebaseOperation in git2 - Rust"
[4]: https://git-scm.com/docs/git-rebase?utm_source=chatgpt.com "Git - git-rebase Documentation"
[5]: https://docs.rs/git2/latest/git2/struct.Rebase.html?utm_source=chatgpt.com "Rebase in git2 - Rust"
[6]: https://docs.rs/git2/latest/src/git2/rebase.rs.html "rebase.rs - source"
[7]: https://libgit2.org/docs/reference/v1.8.0/rebase/git_rebase_finish.html?utm_source=chatgpt.com "git_rebase_finish (libgit2 v1.8.0)"
[8]: https://docs.rs/git2/latest/git2/struct.AnnotatedCommit.html?utm_source=chatgpt.com "AnnotatedCommit in git2 - Rust"
[9]: https://libgit2.org/docs/reference/v0.24.0-rc1/rebase/git_rebase_operation_t.html?utm_source=chatgpt.com "git_rebase_operation_t (libgit2 v0.24.0-rc1)"
[10]: https://stackoverflow.com/questions/73016529/after-git-rebase-finish-the-head-pointer-separately-from-the-master-branch "git rebase - After git_rebase_finish (), the HEAD pointer separately from the master branch - Stack Overflow"
