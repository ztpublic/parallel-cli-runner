# Git Feature Inventory

This list is based on code inspection of `src/` and `src-tauri/`.

## Implemented end-to-end (UI + backend)
- Repo discovery: open folder, scan for git repos with progress, bind selected repos.
- Multi-repo grouping in Branches/Commits/Worktrees panels.
- Git status: branch name, ahead/behind, staged/unstaged file list, clean state message.
- Staging: stage/unstage files, stage all/unstage all.
- Commit: commit message entry + generator, commit staged changes.
- Pull: pull current branch from branch context menu.
- Branch management: list local/remote branches, current badge, ahead/behind indicators, create branch from current, delete local branch, checkout/switch branch, smart switch with auto-stash/unstash, pagination for branches.
- Commit history: list commits, pagination, reset (soft/mixed/hard), revert.
- Worktrees: list worktrees per repo, create new worktree (creates branch + worktree path).
- Remotes: list remotes and fetch/push URLs.
- Error UX: command failure dialog + refresh button; empty states for missing repos/remotes/changes.

## Backend/service capabilities not surfaced in UI
- `git_diff` command (pathspec diff) is registered but unused in frontend.
- `git_merge_into_branch` command exists and is exported but not wired to UI.
- `git_commit` supports `stageAll` and `amend`, but UI always uses `stageAll=false` and `amend=false`.
- `git_detect_repo` is used only by `useGitRepo` hook (unused in main app).
- Internal helpers (not exposed to UI): default branch lookup, diff stats, worktree diff stats, branch existence, latest commit.

## UI placeholders / wiring gaps
- Branch list action "Merge" has no handler.
- Remote branch action "Open PR" has no handler.
- Worktree action "Open" has no handler.
- Worktree delete dialog opens but `onDeleteWorktree` is not passed from `App`, so it never executes.
- Top bar "Git" menu and branch action icon have no bound actions (UI only).

## Missing Git operations/UI (not implemented)
### Repo management
- Clone repository, init new repo.
- Open recent repos; unbind/remove a repo after binding.
- Choose active repo for Changes/Commit tab when multiple repos are bound.

### Status & diff
- File diff viewer (staged vs unstaged), inline/hunk diff.
- Partial staging (hunk/line), discard changes, checkout file from HEAD.
- Display untracked/conflicted counts and conflict resolution workflow.
- File history / blame / annotate.

### Commit workflows
- Amend commit, edit commit message/history, interactive rebase/squash/fixup.
- Cherry-pick commits.
- Signed commits, author/committer overrides.

### Branching & merging
- Merge (UI wiring + conflict resolution), rebase.
- Rename branch, set upstream, track remote branch, checkout remote branch to local.
- Push branches, delete remote branches, compare branches.

### Remotes
- Fetch/push controls, add/remove/edit remotes, set default remote.

### Stash & tags
- Stash list/apply/pop/drop.
- Tag list/create/delete.

### Worktrees
- Create worktree from existing branch or arbitrary start point.
- Open worktree in terminal/file explorer, remove worktree (UI wiring).

### Other
- Git settings (user.name, user.email), gitignore management.
- Submodule support.
