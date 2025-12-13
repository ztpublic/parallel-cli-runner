use std::path::PathBuf;

use tauri::{State, Emitter};
use serde::Serialize;
use uuid::Uuid;

mod command_error;
use crate::command_error::CommandError;

mod git;
use crate::git::RepoStatusDto;
mod agent;
use crate::agent::{Agent, AgentDiffStat, AgentManager};
mod pty;
use crate::pty::PtyManager;

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
async fn git_list_branches(cwd: String) -> Result<Vec<git::BranchInfoDto>, CommandError> {
    let path = PathBuf::from(cwd);
    git::list_branches(&path).map_err(CommandError::from)
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
async fn git_merge_into_branch(
    repo_root: String,
    target_branch: String,
    source_branch: String,
) -> Result<(), CommandError> {
    let path = PathBuf::from(repo_root);
    git::merge_into_branch(&path, &target_branch, &source_branch).map_err(CommandError::from)
}

#[tauri::command]
async fn create_agent(
    manager: State<'_, AgentManager>,
    repo_root: String,
    name: String,
    start_command: String,
    base_branch: Option<String>,
) -> Result<Agent, CommandError> {
    agent::create_agent(&manager, repo_root, name, start_command, base_branch)
        .map_err(CommandError::from)
}

#[tauri::command]
async fn list_agents(
    manager: State<'_, AgentManager>,
    repo_root: String,
) -> Result<Vec<Agent>, CommandError> {
    let path = PathBuf::from(repo_root);
    manager.load_repo_agents(&path).map_err(CommandError::from)
}

#[tauri::command]
async fn cleanup_agents(
    manager: State<'_, AgentManager>,
    repo_root: String,
) -> Result<(), CommandError> {
    agent::cleanup_agents(&manager, repo_root).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn agent_diff_stats(
    manager: State<'_, AgentManager>,
    repo_root: String,
) -> Result<Vec<AgentDiffStat>, CommandError> {
    agent::agent_diff_stats(&manager, repo_root).map_err(CommandError::from)
}

#[tauri::command]
async fn remove_agent(
    manager: State<'_, AgentManager>,
    repo_root: String,
    agent_id: String,
) -> Result<(), CommandError> {
    agent::remove_agent(&manager, repo_root, agent_id).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn open_diff_between_refs(
    worktree_path: String,
    path: Option<String>,
) -> Result<(), CommandError> {
    let worktree = PathBuf::from(worktree_path);
    git::difftool(&worktree, path.as_deref()).map_err(CommandError::from)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyManager::default())
        .manage(AgentManager::default())
        .invoke_handler(tauri::generate_handler![
            pty::create_session,
            pty::write_to_session,
            pty::resize_session,
            pty::kill_session,
            pty::broadcast_line,
            git_detect_repo,
            git_status,
            git_diff,
            git_list_branches,
            git_commit,
            git_merge_into_branch,
            create_agent,
            list_agents,
            cleanup_agents,
            agent_diff_stats,
            remove_agent,
            open_diff_between_refs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}