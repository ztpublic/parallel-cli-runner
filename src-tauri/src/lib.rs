use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use uuid::Uuid;
use agent_client_protocol::{
    ContentBlock, McpServer, PermissionOptionId, RequestPermissionOutcome, SelectedPermissionOutcome,
};

mod command_error;
mod error;
use crate::command_error::CommandError;
use crate::error::AppResult;

pub mod acp;
use crate::acp::{AcpManager, AcpResponseChunk, ai_messages_to_content_blocks};
use crate::acp::types::{AcpAgentConfig, AcpConnectionInfo, AcpEvent};
pub mod git;
use crate::git::{DiffRequestDto, DiffResponseDto, RepoInfoDto, RepoStatusDto};
mod pty;
use crate::pty::PtyManager;
pub mod ws_server;

#[derive(Clone, Serialize)]
struct AppConfig {
    #[serde(rename = "wsUrl")]
    ws_url: String,
    #[serde(rename = "authToken")]
    auth_token: String,
    settings: serde_json::Value,
}

fn build_init_script(config: &AppConfig) -> String {
    let payload = serde_json::to_string(config).expect("failed to serialize app config");
    format!("window.__APP_CONFIG__ = {payload};")
}

#[cfg(test)]
mod export_types;

/// Helper function to execute an operation with a working directory path.
///
/// This converts the string path to a PathBuf and executes the function,
/// automatically converting any AppError to CommandError for Tauri.
fn with_cwd<T>(cwd: String, f: impl FnOnce(&Path) -> AppResult<T>) -> Result<T, CommandError> {
    let path = PathBuf::from(cwd);
    f(&path).map_err(CommandError::from)
}

/// Helper function to execute an operation with a repository root path.
///
/// Similar to `with_cwd` but specifically for repository root operations.
fn with_repo_root<T>(
    repo_root: String,
    f: impl FnOnce(&Path) -> AppResult<T>,
) -> Result<T, CommandError> {
    let path = PathBuf::from(repo_root);
    f(&path).map_err(CommandError::from)
}

fn parse_uuid(id: &str) -> Result<Uuid, CommandError> {
    Uuid::parse_str(id).map_err(|_| CommandError::new("invalid_argument", "invalid id"))
}

fn acp_event_sink(app: tauri::AppHandle) -> acp::types::AcpEventSink {
    Arc::new(move |event| match event {
        AcpEvent::SessionUpdate(payload) => {
            let _ = app.emit("acp-session-update", payload);
        }
        AcpEvent::ConnectionState(payload) => {
            let _ = app.emit("acp-session-state", payload);
        }
        AcpEvent::PermissionRequest(payload) => {
            let _ = app.emit("acp-permission-request", payload);
        }
    })
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

#[tauri::command(rename_all = "camelCase")]
async fn git_list_commits_range(
    cwd: String,
    include_branch: String,
    exclude_branch: String,
) -> Result<Vec<git::CommitInfoDto>, CommandError> {
    with_cwd(cwd, |path| git::list_commits_range(path, &include_branch, &exclude_branch))
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

#[tauri::command]
async fn git_list_tags(
    cwd: String,
    limit: usize,
    skip: Option<usize>,
) -> Result<Vec<git::TagInfoDto>, CommandError> {
    with_cwd(cwd, |path| git::list_tags(path, limit, skip))
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
async fn git_stash_save(cwd: String, message: Option<String>, include_untracked: bool) -> Result<(), CommandError> {
    with_cwd(cwd, |path| git::stash_save(path, message, include_untracked))
}

#[tauri::command(rename_all = "camelCase")]
async fn git_delete_branch(
    repo_root: String,
    branch: String,
    force: bool,
) -> Result<(), CommandError> {
    with_repo_root(repo_root, |root| git::delete_branch(root, &branch, force))
}

/// ACP chat request from the AI SDK frontend
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpChatRequest {
    messages: serde_json::Value,
    agent: AcpAgentConfig,
    env_vars: std::collections::HashMap<String, String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpConnectionIdParams {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpSessionNewParams {
    connection_id: String,
    cwd: String,
    mcp_servers: Option<Vec<McpServer>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpSessionLoadParams {
    connection_id: String,
    session_id: String,
    cwd: String,
    mcp_servers: Option<Vec<McpServer>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpSessionPromptParams {
    session_id: String,
    prompt: Vec<ContentBlock>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpSessionCancelParams {
    session_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpPermissionReplyParams {
    request_id: String,
    outcome: AcpPermissionOutcomeDto,
}

#[derive(Deserialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
enum AcpPermissionOutcomeDto {
    Cancelled,
    Selected {
        #[serde(rename = "optionId")]
        option_id: String,
    },
}

/// Response containing the stream ID for the ACP chat
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AcpChatResponse {
    stream_id: String,
}

/// Handle ACP chat requests from the AI SDK transport
///
/// This command:
/// 1. Converts AI SDK messages to ACP ContentBlocks
/// 2. Gets or creates an ACP session for the agent
/// 3. Sends the prompt to the ACP agent
/// 4. Streams responses via Tauri events
#[tauri::command(rename_all = "camelCase")]
async fn acp_chat(
    app: tauri::AppHandle,
    request: AcpChatRequest,
) -> Result<AcpChatResponse, CommandError> {
    // Get the AcpManager from app state
    let manager = app.state::<Arc<AcpManager>>().inner().clone();

    // Convert AI SDK messages to ACP ContentBlocks
    let content_blocks = ai_messages_to_content_blocks(
        request.messages["messages"].as_array().unwrap_or(&vec![])
    );

    if content_blocks.is_empty() {
        return Err(CommandError::new("invalid_argument", "No valid messages to send"));
    }

    // Create agent config with environment variables
    let mut agent_config = acp::normalize_agent_config(request.agent);
    agent_config.env.extend(request.env_vars);

    // Get or create session for this agent
    let cwd = std::env::current_dir()
        .map_err(|e| CommandError::internal(format!("Failed to get current directory: {}", e)))?
        .to_string_lossy()
        .to_string();

    let session_id = manager.get_or_create_session(agent_config, cwd, vec![]).await
        .map_err(|e| CommandError::internal(format!("Failed to create ACP session: {}", e)))?;

    // Generate a stream ID for this request
    let stream_id = Uuid::new_v4().to_string();

    // Spawn a task to handle the prompt and stream responses
    let manager_clone = manager.clone();
    let app_handle = app.clone();
    let stream_id_clone = stream_id.clone();

    tauri::async_runtime::spawn(async move {
        // Send the prompt
        let result = manager_clone.prompt(session_id.clone(), content_blocks).await;

        match result {
            Ok(prompt_response) => {
                // Note: In ACP protocol, the actual response content comes through
                // session notifications, not in PromptResponse
                // For now, we send a done chunk with the stop reason
                let done_chunk = AcpResponseChunk {
                    chunk_type: "done".to_string(),
                    text: Some(format!("Completed: {:?}", prompt_response.stop_reason)),
                    metadata: Some(serde_json::json!({
                        "stopReason": prompt_response.stop_reason,
                        "meta": prompt_response.meta
                    })),
                };
                let _ = app_handle.emit("acp:chunk", (&stream_id_clone, &done_chunk));
            }
            Err(e) => {
                // Emit error chunk
                let error_chunk = AcpResponseChunk {
                    chunk_type: "error".to_string(),
                    text: Some(format!("ACP prompt failed: {}", e)),
                    metadata: None,
                };
                let _ = app_handle.emit("acp:chunk", (&stream_id_clone, &error_chunk));
            }
        }
    });

    Ok(AcpChatResponse { stream_id })
}

#[tauri::command(rename_all = "camelCase")]
async fn acp_connect(
    app: tauri::AppHandle,
    config: AcpAgentConfig,
) -> Result<AcpConnectionInfo, CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    let config = acp::normalize_agent_config(config);
    manager
        .connect(config)
        .await
        .map_err(|e| CommandError::internal(format!("Failed to connect ACP agent: {e}")))
}

#[tauri::command(rename_all = "camelCase")]
async fn acp_disconnect(
    app: tauri::AppHandle,
    params: AcpConnectionIdParams,
) -> Result<(), CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    let connection_id = parse_uuid(&params.id)?;
    if manager.get_info(connection_id).is_none() {
        return Err(CommandError::new("not_found", "acp connection not found"));
    }
    manager
        .disconnect(connection_id)
        .await
        .map_err(|e| CommandError::internal(format!("Failed to disconnect ACP agent: {e}")))
}

#[tauri::command(rename_all = "camelCase")]
async fn acp_session_new(
    app: tauri::AppHandle,
    params: AcpSessionNewParams,
) -> Result<String, CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    let connection_id = parse_uuid(&params.connection_id)?;
    let mcp_servers = params.mcp_servers.unwrap_or_default();
    let response = manager
        .new_session(connection_id, params.cwd, mcp_servers)
        .await
        .map_err(|e| CommandError::internal(format!("Failed to create ACP session: {e}")))?;
    Ok(response.session_id.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn acp_session_load(
    app: tauri::AppHandle,
    params: AcpSessionLoadParams,
) -> Result<serde_json::Value, CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    let connection_id = parse_uuid(&params.connection_id)?;
    let mcp_servers = params.mcp_servers.unwrap_or_default();
    let response = manager
        .load_session(connection_id, params.session_id, params.cwd, mcp_servers)
        .await
        .map_err(|e| CommandError::internal(format!("Failed to load ACP session: {e}")))?;
    serde_json::to_value(response).map_err(CommandError::internal)
}

#[tauri::command(rename_all = "camelCase")]
async fn acp_session_prompt(
    app: tauri::AppHandle,
    params: AcpSessionPromptParams,
) -> Result<(), CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    manager
        .prompt(params.session_id, params.prompt)
        .await
        .map_err(|e| CommandError::internal(format!("ACP prompt failed: {e}")))?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
async fn acp_session_cancel(
    app: tauri::AppHandle,
    params: AcpSessionCancelParams,
) -> Result<(), CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    manager
        .cancel(params.session_id)
        .await
        .map_err(|e| CommandError::internal(format!("ACP cancel failed: {e}")))?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
async fn acp_permission_reply(
    app: tauri::AppHandle,
    params: AcpPermissionReplyParams,
) -> Result<(), CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    let outcome = match params.outcome {
        AcpPermissionOutcomeDto::Cancelled => RequestPermissionOutcome::Cancelled,
        AcpPermissionOutcomeDto::Selected { option_id } => {
            RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(
                PermissionOptionId::new(option_id),
            ))
        }
    };
    manager
        .reply_permission(params.request_id, outcome)
        .map_err(|e| CommandError::internal(format!("Failed to reply to ACP permission: {e}")))?;
    Ok(())
}

/// Clean up stale ACP sessions
///
/// This should be called periodically to free up resources
#[tauri::command]
async fn acp_cleanup_sessions(app: tauri::AppHandle) -> Result<(), CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    manager.cleanup_stale_sessions();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (listener, port) =
        ws_server::bind_ws_listener(0).expect("failed to bind ws listener");
    let auth_token = Uuid::new_v4().to_string();
    let config = AppConfig {
        ws_url: format!("ws://127.0.0.1:{port}"),
        auth_token: auth_token.clone(),
        settings: serde_json::json!({}),
    };
    let init_script = build_init_script(&config);
    let init_script_for_builder = init_script.clone();

    tauri::Builder::default()
        .append_invoke_initialization_script(init_script_for_builder)
        .setup(move |app| {
            let acp_manager = Arc::new(AcpManager::new(acp_event_sink(app.handle().clone())));
            app.manage(config.clone());
            app.manage(acp_manager.clone());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(&init_script);
            }
            let token = auth_token.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(err) = ws_server::run_ws_server_on_listener(listener, token).await {
                    tracing::error!("ws server error: {err}");
                }
            });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyManager::default())
        .invoke_handler(tauri::generate_handler![
            pty::create_session,
            pty::write_to_session,
            pty::resize_session,
            pty::kill_session,
            pty::broadcast_line,
            acp_connect,
            acp_disconnect,
            acp_session_new,
            acp_session_load,
            acp_session_prompt,
            acp_session_cancel,
            acp_permission_reply,
            acp_chat,
            acp_cleanup_sessions,
            git_detect_repo,
            git_scan_repos,
            git_status,
            git_diff,
            git_unified_diff,
            git_list_branches,
            git_list_remote_branches,
            git_list_commits,
            git_list_commits_range,
            git_list_worktrees,
            git_list_remotes,
            git_list_submodules,
            git_list_stashes,
            git_list_tags,
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
            git_delete_branch,
            git_stash_save
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
