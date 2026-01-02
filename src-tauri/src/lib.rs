use std::path::{Path, PathBuf};
use tauri::Emitter;

mod command_error;
use crate::command_error::CommandError;

pub mod git;
use crate::git::{DiffRequestDto, DiffResponseDto, RepoInfoDto, RepoStatusDto};
mod pty;
use crate::pty::PtyManager;
pub mod ws_server;

#[cfg(test)]
mod export_types;

fn with_cwd<T>(
    cwd: String,
    f: impl FnOnce(&Path) -> Result<T, git::GitError>,
) -> Result<T, CommandError> {
    let path = PathBuf::from(cwd);
    f(&path).map_err(CommandError::from)
}

fn with_repo_root<T>(
    repo_root: String,
    f: impl FnOnce(&Path) -> Result<T, git::GitError>,
) -> Result<T, CommandError> {
    let path = PathBuf::from(repo_root);
    f(&path).map_err(CommandError::from)
}

// Re-export commands from pty module so tauri::generate_handler! can find them
// Note: In a larger app we might register them directly from the module or use a macro
// but for now re-exporting or wrapping them is fine. The generate_handler macro needs
// them to be in scope or importable path.
// Actually, `tauri::generate_handler` can take paths like `pty::create_session`.

#[tauri::command]
async fn git_detect_repo(cwd: String) -> Result<Option<String>, CommandError> {
    with_cwd(cwd, |path| {
        git::detect_repo(path).map(|opt| opt.map(|p| p.to_string_lossy().to_string()))
    })
}

#[tauri::command]
async fn git_scan_repos(
    app: tauri::AppHandle,
    cwd: String,
) -> Result<Vec<RepoInfoDto>, CommandError> {
    with_cwd(cwd, |path| {
        git::scan_repos(path, |p| {
            let _ = app.emit("scan-progress", p);
        })
    })
}

#[tauri::command]
async fn git_status(cwd: String) -> Result<RepoStatusDto, CommandError> {
    with_cwd(cwd, git::status)
}

#[tauri::command]
async fn git_diff(cwd: String, pathspecs: Vec<String>) -> Result<String, CommandError> {
    with_cwd(cwd, |path| git::diff(path, &pathspecs))
}

#[tauri::command]
async fn git_unified_diff(req: DiffRequestDto) -> Result<DiffResponseDto, CommandError> {
    git::get_unified_diff(req).map_err(CommandError::from)
}

#[tauri::command]
async fn git_list_branches(cwd: String) -> Result<Vec<git::BranchInfoDto>, CommandError> {
    with_cwd(cwd, git::list_branches)
}

#[tauri::command]
async fn git_list_remote_branches(
    cwd: String,
) -> Result<Vec<git::BranchInfoDto>, CommandError> {
    with_cwd(cwd, git::list_remote_branches)
}

#[tauri::command]
async fn git_list_commits(
    cwd: String,
    limit: usize,
    skip: Option<usize>,
) -> Result<Vec<git::CommitInfoDto>, CommandError> {
    with_cwd(cwd, |path| git::list_commits(path, limit, skip))
}

#[tauri::command]
async fn git_list_worktrees(
    cwd: String,
) -> Result<Vec<git::WorktreeInfoDto>, CommandError> {
    with_cwd(cwd, git::list_worktrees)
}

#[tauri::command]
async fn git_list_remotes(cwd: String) -> Result<Vec<git::RemoteInfoDto>, CommandError> {
    with_cwd(cwd, git::list_remotes)
}

#[tauri::command]
async fn git_list_submodules(
    cwd: String,
) -> Result<Vec<git::SubmoduleInfoDto>, CommandError> {
    with_cwd(cwd, git::list_submodules)
}

#[tauri::command]
async fn git_list_stashes(cwd: String) -> Result<Vec<git::StashInfoDto>, CommandError> {
    with_cwd(cwd, git::list_stashes)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_apply_stash(cwd: String, index: i32) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::apply_stash(path, index))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_drop_stash(cwd: String, index: i32) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::drop_stash(path, index))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_pull(cwd: String) -> Result<(), CommandError> {
    with_cwd(cwd, git::pull)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_push(cwd: String, force: bool) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::push(path, force))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_commit(
    cwd: String,
    message: String,
    stage_all: bool,
    amend: bool,
) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::commit(path, &message, stage_all, amend))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_stage_files(cwd: String, paths: Vec<String>) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::stage_paths(path, &paths))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_unstage_files(cwd: String, paths: Vec<String>) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::unstage_paths(path, &paths))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_discard_files(cwd: String, paths: Vec<String>) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::discard_paths(path, &paths))
}

#[tauri::command]
async fn git_stage_all(cwd: String) -> Result<(), CommandError> {
    with_cwd(cwd, git::stage_all)
}

#[tauri::command]
async fn git_unstage_all(cwd: String) -> Result<(), CommandError> {
    with_cwd(cwd, git::unstage_all)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_merge_into_branch(
    repo_root: String,
    target_branch: String,
    source_branch: String,
) -> Result<(), CommandError> {
    with_repo_root(repo_root, |path| {
        git::merge_into_branch(path, &target_branch, &source_branch)
    })
}

#[tauri::command(rename_all = "camelCase")]
async fn git_rebase_branch(
    repo_root: String,
    target_branch: String,
    onto_branch: String,
) -> Result<(), CommandError> {
    with_repo_root(repo_root, |path| git::rebase_branch(path, &target_branch, &onto_branch))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_create_branch(
    cwd: String,
    branch_name: String,
    source_branch: Option<String>,
) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::create_branch(path, &branch_name, source_branch))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_checkout_branch(cwd: String, branch_name: String) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::checkout_local_branch(path, &branch_name))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_detach_worktree_head(cwd: String) -> Result<(), CommandError> {
    with_cwd(cwd, git::detach_worktree_head)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_smart_checkout_branch(cwd: String, branch_name: String) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::smart_checkout_branch(path, &branch_name))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_reset(cwd: String, target: String, mode: String) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::reset(path, &target, &mode))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_revert(cwd: String, commit: String) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::revert(path, &commit))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_squash_commits(cwd: String, commits: Vec<String>) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::squash_commits(path, &commits))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_commits_in_remote(cwd: String, commits: Vec<String>) -> Result<bool, CommandError> {
    with_cwd(cwd, |path| git::commits_in_remote(path, &commits))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_add_worktree(
    repo_root: String,
    path: String,
    branch: String,
    start_point: String,
) -> Result<(), CommandError> {
    with_repo_root(repo_root, |root| {
        let worktree_path = PathBuf::from(path);
        git::add_worktree(root, &worktree_path, &branch, &start_point)
    })
}

#[tauri::command(rename_all = "camelCase")]
async fn git_remove_worktree(
    repo_root: String,
    path: String,
    force: bool,
) -> Result<(), CommandError> {
    with_repo_root(repo_root, |root| {
        let worktree_path = PathBuf::from(path);
        git::remove_worktree(root, &worktree_path, force)
    })
}

#[tauri::command(rename_all = "camelCase")]
async fn git_delete_branch(
    repo_root: String,
    branch: String,
    force: bool,
) -> Result<(), CommandError> {
    with_repo_root(repo_root, |root| git::delete_branch(root, &branch, force))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyManager::default())
        .invoke_handler(tauri::generate_handler![
            pty::create_session,
            pty::write_to_session,
            pty::resize_session,
            pty::kill_session,
            pty::broadcast_line,
            git_detect_repo,
            git_scan_repos,
            git_status,
            git_diff,
            git_unified_diff,
            git_list_branches,
            git_list_remote_branches,
            git_list_commits,
            git_list_worktrees,
            git_list_remotes,
            git_list_submodules,
            git_list_stashes,
            git_apply_stash,
            git_drop_stash,
            git_pull,
            git_push,
            git_commit,
            git_stage_files,
            git_unstage_files,
            git_discard_files,
            git_stage_all,
            git_unstage_all,
            git_merge_into_branch,
            git_rebase_branch,
            git_create_branch,
            git_checkout_branch,
            git_detach_worktree_head,
            git_smart_checkout_branch,
            git_reset,
            git_revert,
            git_squash_commits,
            git_commits_in_remote,
            git_add_worktree,
            git_remove_worktree,
            git_delete_branch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
