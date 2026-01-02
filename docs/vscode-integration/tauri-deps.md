# Tauri Dependency Inventory

This inventory captures every Tauri-specific API currently used in the frontend so we can map each call to the WS backend or VSCode extension host.

## Tauri invoke commands

Session/terminal lifecycle:
- `create_session` (params: { cwd?: string }) -> string
- `write_to_session` (params: { id: string; data: string }) -> void
- `resize_session` (params: { id: string; cols: number; rows: number }) -> void
- `kill_session` (params: { id: string }) -> void

Git operations:
- `git_detect_repo`
- `git_scan_repos`
- `git_status`
- `git_list_branches`
- `git_list_remote_branches`
- `git_list_commits`
- `git_list_worktrees`
- `git_list_remotes`
- `git_list_submodules`
- `git_list_stashes`
- `git_apply_stash`
- `git_drop_stash`
- `git_pull`
- `git_push`
- `git_commit`
- `git_stage_files`
- `git_unstage_files`
- `git_discard_files`
- `git_stage_all`
- `git_unstage_all`
- `git_merge_into_branch`
- `git_rebase_branch`
- `git_create_branch`
- `git_checkout_branch`
- `git_detach_worktree_head`
- `git_smart_checkout_branch`
- `git_reset`
- `git_revert`
- `git_squash_commits`
- `git_commits_in_remote`
- `git_add_worktree`
- `git_remove_worktree`
- `git_delete_branch`
- `git_unified_diff`

## Tauri events

- `session-data` payload: { id: string; data: string }
- `scan-progress` payload: string

## Tauri plugins

Dialog:
- `@tauri-apps/plugin-dialog` `open()` used for selecting a folder.

Opener:
- `@tauri-apps/plugin-opener` `openPath(path, openWith?)` used to open repo/worktree paths and staging items.

## Files touching Tauri APIs

- `src/platform/transport.ts` (Tauri invoke/event fallback)
- `src/platform/actions.ts` (dialog/opener fallback)
- `vite.config.ts` (browser mock aliases)
- `src/mocks/tauri.ts`
- `src/mocks/dialog.ts`
- `src/mocks/opener.ts`
