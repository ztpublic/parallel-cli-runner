use std::path::PathBuf;
use tauri::Emitter;

mod command_error;
use crate::command_error::CommandError;

pub mod git;
use crate::git::{DiffRequestDto, DiffResponseDto, RepoInfoDto, RepoStatusDto};
mod pty;
use crate::pty::PtyManager;

#[cfg(test)]
mod export_types;

// Re-export commands from pty module so tauri::generate_handler! can find them
// Note: In a larger app we might register them directly from the module or use a macro
// but for now re-exporting or wrapping them is fine. The generate_handler macro needs
// them to be in scope or importable path.
// Actually, `tauri::generate_handler` can take paths like `pty::create_session`.

#[tauri::command]
async fn git_detect_repo(cwd: String) -> Result<Option<String>, CommandError> {
    let path = PathBuf::from(cwd);
    git::detect_repo(&path)
        .map(|opt| opt.map(|p| p.to_string_lossy().to_string()))
        .map_err(CommandError::from)
}

#[tauri::command]
async fn git_scan_repos(
    app: tauri::AppHandle,
    cwd: String,
) -> Result<Vec<RepoInfoDto>, CommandError> {
    let path = PathBuf::from(cwd);
    git::scan_repos(&path, |p| {
        let _ = app.emit("scan-progress", p);
    })
    .map_err(CommandError::from)
}

#[tauri::command]
async fn git_status(cwd: String) -> Result<RepoStatusDto, CommandError> {
    let path = PathBuf::from(cwd);
    git::status(&path).map_err(CommandError::from)
}

#[tauri::command]
async fn git_diff(cwd: String, pathspecs: Vec<String>) -> Result<String, CommandError> {
    let path = PathBuf::from(cwd);
    git::diff(&path, &pathspecs).map_err(CommandError::from)
}

#[tauri::command]
async fn git_unified_diff(req: DiffRequestDto) -> Result<DiffResponseDto, CommandError> {
    git::get_unified_diff(req).map_err(CommandError::from)
}

#[tauri::command]
async fn git_list_branches(cwd: String) -> Result<Vec<git::BranchInfoDto>, CommandError> {
    let path = PathBuf::from(cwd);
    git::list_branches(&path).map_err(CommandError::from)
}

#[tauri::command]
async fn git_list_remote_branches(
    cwd: String,
) -> Result<Vec<git::BranchInfoDto>, CommandError> {
    let path = PathBuf::from(cwd);
    git::list_remote_branches(&path).map_err(CommandError::from)
}

#[tauri::command]
async fn git_list_commits(
    cwd: String,
    limit: usize,
    skip: Option<usize>,
) -> Result<Vec<git::CommitInfoDto>, CommandError> {
    let path = PathBuf::from(cwd);
    git::list_commits(&path, limit, skip).map_err(CommandError::from)
}

#[tauri::command]
async fn git_list_worktrees(
    cwd: String,
) -> Result<Vec<git::WorktreeInfoDto>, CommandError> {
    let path = PathBuf::from(cwd);
    git::list_worktrees(&path).map_err(CommandError::from)
}

#[tauri::command]
async fn git_list_remotes(cwd: String) -> Result<Vec<git::RemoteInfoDto>, CommandError> {
    let path = PathBuf::from(cwd);
    git::list_remotes(&path).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_pull(cwd: String) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::pull(&path).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_push(cwd: String, force: bool) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::push(&path, force).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_commit(
    cwd: String,
    message: String,
    stage_all: bool,
    amend: bool,
) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::commit(&path, &message, stage_all, amend).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_stage_files(cwd: String, paths: Vec<String>) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::stage_paths(&path, &paths).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_unstage_files(cwd: String, paths: Vec<String>) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::unstage_paths(&path, &paths).map_err(CommandError::from)
}

#[tauri::command]
async fn git_stage_all(cwd: String) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::stage_all(&path).map_err(CommandError::from)
}

#[tauri::command]
async fn git_unstage_all(cwd: String) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::unstage_all(&path).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_merge_into_branch(
    repo_root: String,
    target_branch: String,
    source_branch: String,
) -> Result<(), CommandError> {
    let path = PathBuf::from(repo_root);
    git::merge_into_branch(&path, &target_branch, &source_branch).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_create_branch(
    cwd: String,
    branch_name: String,
    source_branch: Option<String>,
) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::create_branch(&path, &branch_name, source_branch).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_checkout_branch(cwd: String, branch_name: String) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::checkout_local_branch(&path, &branch_name).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_smart_checkout_branch(cwd: String, branch_name: String) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::smart_checkout_branch(&path, &branch_name).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_reset(cwd: String, target: String, mode: String) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::reset(&path, &target, &mode).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_revert(cwd: String, commit: String) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::revert(&path, &commit).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_add_worktree(
    repo_root: String,
    path: String,
    branch: String,
    start_point: String,
) -> Result<(), CommandError> {
    let root = PathBuf::from(repo_root);
    let worktree_path = PathBuf::from(path);
    git::add_worktree(&root, &worktree_path, &branch, &start_point).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_remove_worktree(
    repo_root: String,
    path: String,
    force: bool,
) -> Result<(), CommandError> {
    let root = PathBuf::from(repo_root);
    let worktree_path = PathBuf::from(path);
    git::remove_worktree(&root, &worktree_path, force).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_delete_branch(
    repo_root: String,
    branch: String,
    force: bool,
) -> Result<(), CommandError> {
    let root = PathBuf::from(repo_root);
    git::delete_branch(&root, &branch, force).map_err(CommandError::from)
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
            git_pull,
            git_push,
            git_commit,
            git_stage_files,
            git_unstage_files,
            git_stage_all,
            git_unstage_all,
            git_merge_into_branch,
            git_create_branch,
            git_checkout_branch,
            git_smart_checkout_branch,
            git_reset,
            git_revert,
            git_add_worktree,
            git_remove_worktree,
            git_delete_branch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
