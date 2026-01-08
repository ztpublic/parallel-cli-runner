use agent_client_protocol::{
    PermissionOptionId, RequestPermissionOutcome, SelectedPermissionOutcome,
};
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::command_error::CommandError;
use crate::acp;
use crate::git::{self, DiffRequestDto};
use crate::utils;
use crate::pty::{
    broadcast_line_with_manager, create_session_with_emitter, kill_session_with_manager,
    resize_session_with_manager, write_to_session_with_manager, SessionDataEmitter,
};
use crate::acp::types::AcpAgentConfig;

use super::types::*;

pub async fn handle_request(
    method: String,
    params: Option<Value>,
    state: WsState,
) -> Result<Value, CommandError> {
    match method.as_str() {
        "create_session" => {
            let params: CreateSessionParams = parse_params(params)?;
            let manager = state.manager.clone();
            let events = state.events.clone();
            let session_id = run_blocking(move || {
                let emitter = session_emitter(events);
                create_session_with_emitter(&manager, emitter, params.cmd, params.cwd)
            })
            .await?;
            to_value(session_id)
        }
        "write_to_session" => {
            let params: WriteSessionParams = parse_params(params)?;
            let manager = state.manager.clone();
            run_blocking(move || write_to_session_with_manager(&manager, params.id, params.data))
                .await?;
            Ok(Value::Null)
        }
        "resize_session" => {
            let params: ResizeSessionParams = parse_params(params)?;
            let manager = state.manager.clone();
            run_blocking(move || {
                resize_session_with_manager(&manager, params.id, params.cols, params.rows)
            })
            .await?;
            Ok(Value::Null)
        }
        "kill_session" => {
            let params: SessionIdParams = parse_params(params)?;
            let manager = state.manager.clone();
            run_blocking(move || kill_session_with_manager(&manager, params.id)).await?;
            Ok(Value::Null)
        }
        "broadcast_line" => {
            let params: BroadcastLineParams = parse_params(params)?;
            let manager = state.manager.clone();
            run_blocking(move || {
                broadcast_line_with_manager(&manager, params.session_ids, params.line)
            })
            .await?;
            Ok(Value::Null)
        }
        "acp_connect" => {
            let params: AcpAgentConfig = parse_params(params)?;
            let manager = state.acp.clone();
            let config = acp::normalize_agent_config(params);
            let info = manager.connect(config).await.map_err(CommandError::internal)?;
            to_value(info)
        }
        "acp_disconnect" => {
            let params: AcpConnectionIdParams = parse_params(params)?;
            let connection_id = parse_uuid(&params.id)?;
            let manager = state.acp.clone();
            if manager.get_info(connection_id).is_none() {
                return Err(CommandError::new("not_found", "acp connection not found"));
            }
            manager
                .disconnect(connection_id)
                .await
                .map_err(CommandError::internal)?;
            Ok(Value::Null)
        }
        "acp_session_new" => {
            let params: AcpSessionNewParams = parse_params(params)?;
            let connection_id = parse_uuid(&params.connection_id)?;
            let mcp_servers = params.mcp_servers.unwrap_or_default();
            let manager = state.acp.clone();
            let response = manager
                .new_session(connection_id, params.cwd, mcp_servers)
                .await
                .map_err(CommandError::internal)?;
            to_value(response.session_id.to_string())
        }
        "acp_session_load" => {
            let params: AcpSessionLoadParams = parse_params(params)?;
            let connection_id = parse_uuid(&params.connection_id)?;
            let mcp_servers = params.mcp_servers.unwrap_or_default();
            let manager = state.acp.clone();
            let response = manager
                .load_session(connection_id, params.session_id, params.cwd, mcp_servers)
                .await
                .map_err(CommandError::internal)?;
            to_value(response)
        }
        "acp_session_prompt" => {
            let params: AcpSessionPromptParams = parse_params(params)?;
            let manager = state.acp.clone();
            manager
                .prompt(params.session_id, params.prompt)
                .await
                .map_err(CommandError::internal)?;
            Ok(Value::Null)
        }
        "acp_session_cancel" => {
            let params: AcpSessionCancelParams = parse_params(params)?;
            let manager = state.acp.clone();
            manager
                .cancel(params.session_id)
                .await
                .map_err(CommandError::internal)?;
            Ok(Value::Null)
        }
        "acp_permission_reply" => {
            let params: AcpPermissionReplyParams = parse_params(params)?;
            let outcome = match params.outcome {
                AcpPermissionOutcomeDto::Cancelled => RequestPermissionOutcome::Cancelled,
                AcpPermissionOutcomeDto::Selected { option_id } => {
                    RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(
                        PermissionOptionId::new(option_id),
                    ))
                }
            };
            state
                .acp
                .reply_permission(params.request_id, outcome)
                .map_err(CommandError::internal)?;
            Ok(Value::Null)
        }
        "git_detect_repo" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || {
                utils::with_cwd(params.cwd, |path| {
                    git::detect_repo(path).map(|opt| opt.map(|p| p.to_string_lossy().to_string()))
                })
            })
            .await?;
            to_value(result)
        }
        "git_scan_repos" => {
            let params: CwdParams = parse_params(params)?;
            let events = state.events.clone();
            let result = run_blocking(move || {
                utils::with_cwd(params.cwd, |path| {
                    git::scan_repos(path, |p| emit_event(&events, "scan-progress", p))
                })
            })
            .await?;
            to_value(result)
        }
        "git_status" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || utils::with_cwd(params.cwd, git::status)).await?;
            to_value(result)
        }
        "git_diff" => {
            let params: GitDiffParams = parse_params(params)?;
            let result = run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::diff(path, &params.pathspecs))
            })
            .await?;
            to_value(result)
        }
        "git_unified_diff" => {
            let params: DiffRequestDto = parse_params(params)?;
            let result = run_blocking(move || {
                git::get_unified_diff(params).map_err(CommandError::from)
            })
            .await?;
            to_value(result)
        }
        "git_list_branches" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || utils::with_cwd(params.cwd, git::list_branches)).await?;
            to_value(result)
        }
        "git_list_remote_branches" => {
            let params: CwdParams = parse_params(params)?;
            let result =
                run_blocking(move || utils::with_cwd(params.cwd, git::list_remote_branches)).await?;
            to_value(result)
        }
        "git_list_commits" => {
            let params: GitListCommitsParams = parse_params(params)?;
            let result = run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::list_commits(path, params.limit, params.skip))
            })
            .await?;
            to_value(result)
        }
        "git_list_commits_range" => {
            let params: GitListCommitsRangeParams = parse_params(params)?;
            let result = run_blocking(move || {
                utils::with_cwd(params.cwd, |path| {
                    git::list_commits_range(path, &params.include_branch, &params.exclude_branch)
                })
            })
            .await?;
            to_value(result)
        }
        "git_list_worktrees" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || utils::with_cwd(params.cwd, git::list_worktrees)).await?;
            to_value(result)
        }
        "git_list_remotes" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || utils::with_cwd(params.cwd, git::list_remotes)).await?;
            to_value(result)
        }
        "git_list_submodules" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || utils::with_cwd(params.cwd, git::list_submodules)).await?;
            to_value(result)
        }
        "git_list_stashes" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || utils::with_cwd(params.cwd, git::list_stashes)).await?;
            to_value(result)
        }
        "git_list_tags" => {
            let params: GitListTagsParams = parse_params(params)?;
            let result = run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::list_tags(path, params.limit, params.skip))
            })
            .await?;
            to_value(result)
        }
        "git_apply_stash" => {
            let params: GitApplyStashParams = parse_params(params)?;
            run_blocking(move || utils::with_cwd(params.cwd, |path| git::apply_stash(path, params.index)))
                .await?;
            Ok(Value::Null)
        }
        "git_drop_stash" => {
            let params: GitApplyStashParams = parse_params(params)?;
            run_blocking(move || utils::with_cwd(params.cwd, |path| git::drop_stash(path, params.index)))
                .await?;
            Ok(Value::Null)
        }
        "git_pull" => {
            let params: CwdParams = parse_params(params)?;
            run_blocking(move || utils::with_cwd(params.cwd, git::pull)).await?;
            Ok(Value::Null)
        }
        "git_push" => {
            let params: GitPushParams = parse_params(params)?;
            run_blocking(move || utils::with_cwd(params.cwd, |path| git::push(path, params.force))).await?;
            Ok(Value::Null)
        }
        "git_commit" => {
            let params: GitCommitParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| {
                    git::commit(path, &params.message, params.stage_all, params.amend)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_stage_files" => {
            let params: GitStageFilesParams = parse_params(params)?;
            run_blocking(move || utils::with_cwd(params.cwd, |path| git::stage_paths(path, &params.paths)))
                .await?;
            Ok(Value::Null)
        }
        "git_unstage_files" => {
            let params: GitStageFilesParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::unstage_paths(path, &params.paths))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_discard_files" => {
            let params: GitStageFilesParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::discard_paths(path, &params.paths))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_stage_all" => {
            let params: CwdParams = parse_params(params)?;
            run_blocking(move || utils::with_cwd(params.cwd, git::stage_all)).await?;
            Ok(Value::Null)
        }
        "git_unstage_all" => {
            let params: CwdParams = parse_params(params)?;
            run_blocking(move || utils::with_cwd(params.cwd, git::unstage_all)).await?;
            Ok(Value::Null)
        }
        "git_merge_into_branch" => {
            let params: GitMergeParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_repo_root(params.repo_root, |path| {
                    git::merge_into_branch(path, &params.target_branch, &params.source_branch)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_rebase_branch" => {
            let params: GitRebaseParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_repo_root(params.repo_root, |path| {
                    git::rebase_branch(path, &params.target_branch, &params.onto_branch)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_create_branch" => {
            let params: GitCreateBranchParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| {
                    git::create_branch(path, &params.branch_name, params.source_branch)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_checkout_branch" => {
            let params: GitCheckoutBranchParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::checkout_local_branch(path, &params.branch_name))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_detach_worktree_head" => {
            let params: CwdParams = parse_params(params)?;
            run_blocking(move || utils::with_cwd(params.cwd, git::detach_worktree_head)).await?;
            Ok(Value::Null)
        }
        "git_smart_checkout_branch" => {
            let params: GitSmartCheckoutParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::smart_checkout_branch(path, &params.branch_name))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_reset" => {
            let params: GitResetParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::reset(path, &params.target, &params.mode))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_revert" => {
            let params: GitRevertParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::revert(path, &params.commit))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_squash_commits" => {
            let params: GitSquashParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::squash_commits(path, &params.commits))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_commits_in_remote" => {
            let params: GitCommitsInRemoteParams = parse_params(params)?;
            let result = run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::commits_in_remote(path, &params.commits))
            })
            .await?;
            to_value(result)
        }
        "git_add_worktree" => {
            let params: GitAddWorktreeParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_repo_root(params.repo_root, |root| {
                    let worktree_path = std::path::PathBuf::from(params.path);
                    git::add_worktree(root, &worktree_path, &params.branch, &params.start_point)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_remove_worktree" => {
            let params: GitRemoveWorktreeParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_repo_root(params.repo_root, |root| {
                    let worktree_path = std::path::PathBuf::from(params.path);
                    git::remove_worktree(root, &worktree_path, params.force)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_delete_branch" => {
            let params: GitDeleteBranchParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_repo_root(params.repo_root, |root| {
                    git::delete_branch(root, &params.branch, params.force)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_stash_save" => {
            let params: GitStashSaveParams = parse_params(params)?;
            run_blocking(move || {
                utils::with_cwd(params.cwd, |path| git::stash_save(path, params.message, params.include_untracked))
            })
            .await?;
            Ok(Value::Null)
        }
        "dialog.open" => {
            let params: OpenDialogParams = parse_params(params)?;
            let result = run_blocking(move || Ok(handle_dialog_open(params))).await?;
            Ok(result)
        }
        "shell.openPath" => {
            let params: OpenPathParams = parse_params(params)?;
            run_blocking(move || handle_open_path(params)).await?;
            Ok(Value::Null)
        }
        _ => Err(CommandError::new("not_found", "unknown method")),
    }
}

fn parse_params<T>(params: Option<Value>) -> Result<T, CommandError>
where
    T: for<'de> Deserialize<'de>,
{
    let value = params.unwrap_or(Value::Null);
    serde_json::from_value(value)
        .map_err(|err| CommandError::new("invalid_argument", err.to_string()))
}

fn to_value<T: serde::Serialize>(value: T) -> Result<Value, CommandError> {
    serde_json::to_value(value).map_err(CommandError::internal)
}

fn parse_uuid(id: &str) -> Result<Uuid, CommandError> {
    Uuid::parse_str(id).map_err(|_| CommandError::new("invalid_argument", "invalid id"))
}

async fn run_blocking<T, F>(task: F) -> Result<T, CommandError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, CommandError> + Send + 'static,
{
    tokio::task::spawn_blocking(task)
        .await
        .map_err(CommandError::internal)?
}

fn session_emitter(events: broadcast::Sender<EventMessage>) -> SessionDataEmitter {
    Arc::new(move |payload| {
        emit_event(&events, "session-data", payload);
    })
}

fn emit_event<T: serde::Serialize>(events: &broadcast::Sender<EventMessage>, event: &str, payload: T) {
    let Ok(value) = serde_json::to_value(payload) else {
        return;
    };
    let _ = events.send(EventMessage {
        event: event.to_string(),
        payload: value,
    });
}

fn handle_dialog_open(params: OpenDialogParams) -> Value {
    let mut dialog = rfd::FileDialog::new();
    if let Some(title) = params.title.as_deref() {
        dialog = dialog.set_title(title);
    }

    let directory = params.directory.unwrap_or(false);
    let multiple = params.multiple.unwrap_or(false);

    if directory {
        if multiple {
            return paths_to_value(dialog.pick_folders());
        }
        return path_to_value(dialog.pick_folder());
    }

    if multiple {
        return paths_to_value(dialog.pick_files());
    }
    path_to_value(dialog.pick_file())
}

fn handle_open_path(params: OpenPathParams) -> Result<(), CommandError> {
    if let Some(open_with) = params.open_with.as_deref() {
        open::with(&params.path, open_with).map_err(CommandError::internal)?;
    } else {
        open::that(&params.path).map_err(CommandError::internal)?;
    }
    Ok(())
}

fn path_to_value(path: Option<std::path::PathBuf>) -> Value {
    match path {
        Some(path) => Value::String(path.to_string_lossy().to_string()),
        None => Value::Null,
    }
}

fn paths_to_value(paths: Option<Vec<std::path::PathBuf>>) -> Value {
    match paths {
        Some(paths) => Value::Array(
            paths
                .into_iter()
                .map(|path| Value::String(path.to_string_lossy().to_string()))
                .collect(),
        ),
        None => Value::Null,
    }
}
