use std::sync::Arc;

use serde::Serialize;
use tauri::{Emitter, Manager};
use uuid::Uuid;

mod command_error;
mod commands;
mod error;
mod utils;

pub mod acp;
use crate::acp::AcpManager;
use crate::acp::types::AcpEvent;
pub mod git;
mod pty;
use crate::pty::PtyManager;
pub mod ws;
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
            // PTY commands
            pty::create_session,
            pty::write_to_session,
            pty::resize_session,
            pty::kill_session,
            pty::broadcast_line,
            // ACP commands
            commands::acp_connect,
            commands::acp_disconnect,
            commands::acp_session_new,
            commands::acp_session_load,
            commands::acp_session_prompt,
            commands::acp_session_cancel,
            commands::acp_permission_reply,
            commands::acp_chat,
            commands::acp_cleanup_sessions,
            // Git commands
            commands::git_detect_repo,
            commands::git_scan_repos,
            commands::git_status,
            commands::git_diff,
            commands::git_unified_diff,
            commands::git_list_branches,
            commands::git_list_remote_branches,
            commands::git_list_commits,
            commands::git_list_commits_range,
            commands::git_list_worktrees,
            commands::git_list_remotes,
            commands::git_list_submodules,
            commands::git_list_stashes,
            commands::git_list_tags,
            commands::git_apply_stash,
            commands::git_drop_stash,
            commands::git_pull,
            commands::git_push,
            commands::git_commit,
            commands::git_stage_files,
            commands::git_unstage_files,
            commands::git_discard_files,
            commands::git_stage_all,
            commands::git_unstage_all,
            commands::git_merge_into_branch,
            commands::git_rebase_branch,
            commands::git_create_branch,
            commands::git_checkout_branch,
            commands::git_detach_worktree_head,
            commands::git_smart_checkout_branch,
            commands::git_reset,
            commands::git_revert,
            commands::git_squash_commits,
            commands::git_commits_in_remote,
            commands::git_add_worktree,
            commands::git_remove_worktree,
            commands::git_delete_branch,
            commands::git_stash_save
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
