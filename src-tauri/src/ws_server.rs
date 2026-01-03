use std::path::PathBuf;
use std::sync::Arc;

use agent_client_protocol::{
    ContentBlock, McpServer, PermissionOptionId, RequestPermissionOutcome,
    SelectedPermissionOutcome,
};
use futures_util::{SinkExt, StreamExt};
use http::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::net::TcpListener as TokioTcpListener;
use tokio::sync::{broadcast, mpsc};
use tokio_tungstenite::accept_hdr_async;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;

use crate::command_error::CommandError;
use crate::acp::{self, types::{AcpAgentConfig, AcpEvent}};
use crate::git::{self, DiffRequestDto};
use crate::pty::{
    broadcast_line_with_manager, create_session_with_emitter, kill_session_with_manager,
    resize_session_with_manager, write_to_session_with_manager, PtyManager, SessionData,
    SessionDataEmitter,
};

#[derive(Clone)]
struct EventMessage {
    event: String,
    payload: Value,
}

#[derive(Clone)]
struct WsState {
    manager: PtyManager,
    acp: acp::AcpManager,
    events: broadcast::Sender<EventMessage>,
}

#[derive(Deserialize)]
struct TransportRequest {
    #[serde(rename = "type")]
    kind: String,
    id: String,
    method: String,
    params: Option<Value>,
}

#[derive(Serialize)]
struct TransportResponse {
    #[serde(rename = "type")]
    kind: &'static str,
    id: String,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<TransportError>,
}

#[derive(Serialize)]
struct TransportError {
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
}

#[derive(Serialize)]
struct TransportEvent {
    #[serde(rename = "type")]
    kind: &'static str,
    event: String,
    payload: Value,
}

#[derive(Deserialize)]
struct CreateSessionParams {
    cmd: Option<String>,
    cwd: Option<String>,
}

#[derive(Deserialize)]
struct SessionIdParams {
    id: String,
}

#[derive(Deserialize)]
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
    Selected { option_id: String },
}

#[derive(Deserialize)]
struct WriteSessionParams {
    id: String,
    data: String,
}

#[derive(Deserialize)]
struct ResizeSessionParams {
    id: String,
    cols: u16,
    rows: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BroadcastLineParams {
    session_ids: Vec<String>,
    line: String,
}

#[derive(Deserialize)]
struct CwdParams {
    cwd: String,
}

#[derive(Deserialize)]
struct GitDiffParams {
    cwd: String,
    pathspecs: Vec<String>,
}

#[derive(Deserialize)]
struct GitListCommitsParams {
    cwd: String,
    limit: usize,
    skip: Option<usize>,
}

#[derive(Deserialize)]
struct GitListTagsParams {
    cwd: String,
    limit: usize,
    skip: Option<usize>,
}

#[derive(Deserialize)]
struct GitApplyStashParams {
    cwd: String,
    index: i32,
}

#[derive(Deserialize)]
struct GitPushParams {
    cwd: String,
    force: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitParams {
    cwd: String,
    message: String,
    stage_all: bool,
    amend: bool,
}

#[derive(Deserialize)]
struct GitStageFilesParams {
    cwd: String,
    paths: Vec<String>,
}

#[derive(Deserialize)]
struct GitResetParams {
    cwd: String,
    target: String,
    mode: String,
}

#[derive(Deserialize)]
struct GitRevertParams {
    cwd: String,
    commit: String,
}

#[derive(Deserialize)]
struct GitSquashParams {
    cwd: String,
    commits: Vec<String>,
}

#[derive(Deserialize)]
struct GitCommitsInRemoteParams {
    cwd: String,
    commits: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitMergeParams {
    repo_root: String,
    target_branch: String,
    source_branch: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitRebaseParams {
    repo_root: String,
    target_branch: String,
    onto_branch: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCreateBranchParams {
    cwd: String,
    branch_name: String,
    source_branch: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCheckoutBranchParams {
    cwd: String,
    branch_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitSmartCheckoutParams {
    cwd: String,
    branch_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitAddWorktreeParams {
    repo_root: String,
    path: String,
    branch: String,
    start_point: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitRemoveWorktreeParams {
    repo_root: String,
    path: String,
    force: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitStashSaveParams {
    cwd: String,
    message: Option<String>,
    include_untracked: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitDeleteBranchParams {
    repo_root: String,
    branch: String,
    force: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenDialogParams {
    directory: Option<bool>,
    multiple: Option<bool>,
    title: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenPathParams {
    path: String,
    open_with: Option<String>,
}

pub async fn run_ws_server(port: u16, auth_token: String) -> anyhow::Result<()> {
    let listener = TokioTcpListener::bind(("127.0.0.1", port)).await?;
    run_ws_server_on_tokio_listener(listener, auth_token).await
}

pub fn bind_ws_listener(port: u16) -> anyhow::Result<(std::net::TcpListener, u16)> {
    let std_listener = std::net::TcpListener::bind(("127.0.0.1", port))?;
    std_listener.set_nonblocking(true)?;
    let actual_port = std_listener.local_addr()?.port();
    Ok((std_listener, actual_port))
}

pub async fn run_ws_server_on_listener(
    listener: std::net::TcpListener,
    auth_token: String,
) -> anyhow::Result<()> {
    listener.set_nonblocking(true)?;
    let listener = TokioTcpListener::from_std(listener)?;
    run_ws_server_on_tokio_listener(listener, auth_token).await
}

async fn run_ws_server_on_tokio_listener(
    listener: TokioTcpListener,
    auth_token: String,
) -> anyhow::Result<()> {
    let events = broadcast::channel(256).0;
    let state = WsState {
        manager: PtyManager::default(),
        acp: acp::AcpManager::new(acp_event_sink(events.clone())),
        events,
    };

    loop {
        let (stream, _addr) = listener.accept().await?;
        let state = state.clone();
        let token = auth_token.clone();
        tokio::spawn(async move {
            if let Err(err) = handle_connection(stream, state, token).await {
                eprintln!("ws connection error: {err}");
            }
        });
    }
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    state: WsState,
    expected_token: String,
) -> anyhow::Result<()> {
    let ws_stream = accept_hdr_async(stream, |req: &Request, resp: Response| {
        if is_authorized(req, &expected_token) {
            Ok(resp)
        } else {
            Err(unauthorized_response())
        }
    })
    .await?;

    let (mut write, mut read) = ws_stream.split();
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<Message>();
    let mut event_rx = state.events.subscribe();

    let writer = tokio::spawn(async move {
        while let Some(message) = out_rx.recv().await {
            if write.send(message).await.is_err() {
                break;
            }
        }
    });

    let event_forwarder = {
        let out_tx = out_tx.clone();
        tokio::spawn(async move {
            while let Ok(event) = event_rx.recv().await {
                let payload = TransportEvent {
                    kind: "event",
                    event: event.event,
                    payload: event.payload,
                };
                if let Ok(text) = serde_json::to_string(&payload) {
                    if out_tx.send(Message::Text(text.into())).is_err() {
                        break;
                    }
                }
            }
        })
    };

    while let Some(message) = read.next().await {
        let message = match message {
            Ok(message) => message,
            Err(_) => break,
        };

        if let Message::Text(text) = message {
            let Ok(request) = serde_json::from_str::<TransportRequest>(&text) else {
                continue;
            };
            if request.kind != "request" {
                continue;
            }

            let state = state.clone();
            let out_tx = out_tx.clone();
            tokio::spawn(async move {
                let response = match handle_request(request.method, request.params, state).await {
                    Ok(result) => TransportResponse {
                        kind: "response",
                        id: request.id,
                        ok: true,
                        result: Some(result),
                        error: None,
                    },
                    Err(err) => TransportResponse {
                        kind: "response",
                        id: request.id,
                        ok: false,
                        result: None,
                        error: Some(TransportError {
                            message: err.message,
                            code: Some(err.code),
                        }),
                    },
                };

                if let Ok(text) = serde_json::to_string(&response) {
                    let _ = out_tx.send(Message::Text(text.into()));
                }
            });
        }
    }

    drop(out_tx);
    let _ = writer.await;
    let _ = event_forwarder.await;
    Ok(())
}

fn is_authorized(request: &Request, expected_token: &str) -> bool {
    request
        .uri()
        .query()
        .and_then(extract_token)
        .map(|token| token == expected_token)
        .unwrap_or(false)
}

fn extract_token(query: &str) -> Option<String> {
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let key = parts.next()?;
        let value = parts.next().unwrap_or("");
        if key == "token" {
            return Some(value.to_string());
        }
    }
    None
}

fn unauthorized_response() -> ErrorResponse {
    http::Response::builder()
        .status(StatusCode::UNAUTHORIZED)
        .body(Some("unauthorized".to_string()))
        .unwrap_or_else(|_| http::Response::new(Some("unauthorized".to_string())))
}

async fn handle_request(
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
            let info = manager.connect(params).await.map_err(CommandError::internal)?;
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
                with_cwd(params.cwd, |path| {
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
                with_cwd(params.cwd, |path| {
                    git::scan_repos(path, |p| emit_event(&events, "scan-progress", p))
                })
            })
            .await?;
            to_value(result)
        }
        "git_status" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || with_cwd(params.cwd, git::status)).await?;
            to_value(result)
        }
        "git_diff" => {
            let params: GitDiffParams = parse_params(params)?;
            let result = run_blocking(move || {
                with_cwd(params.cwd, |path| git::diff(path, &params.pathspecs))
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
            let result = run_blocking(move || with_cwd(params.cwd, git::list_branches)).await?;
            to_value(result)
        }
        "git_list_remote_branches" => {
            let params: CwdParams = parse_params(params)?;
            let result =
                run_blocking(move || with_cwd(params.cwd, git::list_remote_branches)).await?;
            to_value(result)
        }
        "git_list_commits" => {
            let params: GitListCommitsParams = parse_params(params)?;
            let result = run_blocking(move || {
                with_cwd(params.cwd, |path| git::list_commits(path, params.limit, params.skip))
            })
            .await?;
            to_value(result)
        }
        "git_list_worktrees" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || with_cwd(params.cwd, git::list_worktrees)).await?;
            to_value(result)
        }
        "git_list_remotes" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || with_cwd(params.cwd, git::list_remotes)).await?;
            to_value(result)
        }
        "git_list_submodules" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || with_cwd(params.cwd, git::list_submodules)).await?;
            to_value(result)
        }
        "git_list_stashes" => {
            let params: CwdParams = parse_params(params)?;
            let result = run_blocking(move || with_cwd(params.cwd, git::list_stashes)).await?;
            to_value(result)
        }
        "git_list_tags" => {
            let params: GitListTagsParams = parse_params(params)?;
            let result = run_blocking(move || {
                with_cwd(params.cwd, |path| git::list_tags(path, params.limit, params.skip))
            })
            .await?;
            to_value(result)
        }
        "git_apply_stash" => {
            let params: GitApplyStashParams = parse_params(params)?;
            run_blocking(move || with_cwd(params.cwd, |path| git::apply_stash(path, params.index)))
                .await?;
            Ok(Value::Null)
        }
        "git_drop_stash" => {
            let params: GitApplyStashParams = parse_params(params)?;
            run_blocking(move || with_cwd(params.cwd, |path| git::drop_stash(path, params.index)))
                .await?;
            Ok(Value::Null)
        }
        "git_pull" => {
            let params: CwdParams = parse_params(params)?;
            run_blocking(move || with_cwd(params.cwd, git::pull)).await?;
            Ok(Value::Null)
        }
        "git_push" => {
            let params: GitPushParams = parse_params(params)?;
            run_blocking(move || with_cwd(params.cwd, |path| git::push(path, params.force))).await?;
            Ok(Value::Null)
        }
        "git_commit" => {
            let params: GitCommitParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| {
                    git::commit(path, &params.message, params.stage_all, params.amend)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_stage_files" => {
            let params: GitStageFilesParams = parse_params(params)?;
            run_blocking(move || with_cwd(params.cwd, |path| git::stage_paths(path, &params.paths)))
                .await?;
            Ok(Value::Null)
        }
        "git_unstage_files" => {
            let params: GitStageFilesParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| git::unstage_paths(path, &params.paths))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_discard_files" => {
            let params: GitStageFilesParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| git::discard_paths(path, &params.paths))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_stage_all" => {
            let params: CwdParams = parse_params(params)?;
            run_blocking(move || with_cwd(params.cwd, git::stage_all)).await?;
            Ok(Value::Null)
        }
        "git_unstage_all" => {
            let params: CwdParams = parse_params(params)?;
            run_blocking(move || with_cwd(params.cwd, git::unstage_all)).await?;
            Ok(Value::Null)
        }
        "git_merge_into_branch" => {
            let params: GitMergeParams = parse_params(params)?;
            run_blocking(move || {
                with_repo_root(params.repo_root, |path| {
                    git::merge_into_branch(path, &params.target_branch, &params.source_branch)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_rebase_branch" => {
            let params: GitRebaseParams = parse_params(params)?;
            run_blocking(move || {
                with_repo_root(params.repo_root, |path| {
                    git::rebase_branch(path, &params.target_branch, &params.onto_branch)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_create_branch" => {
            let params: GitCreateBranchParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| {
                    git::create_branch(path, &params.branch_name, params.source_branch)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_checkout_branch" => {
            let params: GitCheckoutBranchParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| git::checkout_local_branch(path, &params.branch_name))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_detach_worktree_head" => {
            let params: CwdParams = parse_params(params)?;
            run_blocking(move || with_cwd(params.cwd, git::detach_worktree_head)).await?;
            Ok(Value::Null)
        }
        "git_smart_checkout_branch" => {
            let params: GitSmartCheckoutParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| git::smart_checkout_branch(path, &params.branch_name))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_reset" => {
            let params: GitResetParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| git::reset(path, &params.target, &params.mode))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_revert" => {
            let params: GitRevertParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| git::revert(path, &params.commit))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_squash_commits" => {
            let params: GitSquashParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| git::squash_commits(path, &params.commits))
            })
            .await?;
            Ok(Value::Null)
        }
        "git_commits_in_remote" => {
            let params: GitCommitsInRemoteParams = parse_params(params)?;
            let result = run_blocking(move || {
                with_cwd(params.cwd, |path| git::commits_in_remote(path, &params.commits))
            })
            .await?;
            to_value(result)
        }
        "git_add_worktree" => {
            let params: GitAddWorktreeParams = parse_params(params)?;
            run_blocking(move || {
                with_repo_root(params.repo_root, |root| {
                    let worktree_path = PathBuf::from(params.path);
                    git::add_worktree(root, &worktree_path, &params.branch, &params.start_point)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_remove_worktree" => {
            let params: GitRemoveWorktreeParams = parse_params(params)?;
            run_blocking(move || {
                with_repo_root(params.repo_root, |root| {
                    let worktree_path = PathBuf::from(params.path);
                    git::remove_worktree(root, &worktree_path, params.force)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_delete_branch" => {
            let params: GitDeleteBranchParams = parse_params(params)?;
            run_blocking(move || {
                with_repo_root(params.repo_root, |root| {
                    git::delete_branch(root, &params.branch, params.force)
                })
            })
            .await?;
            Ok(Value::Null)
        }
        "git_stash_save" => {
            let params: GitStashSaveParams = parse_params(params)?;
            run_blocking(move || {
                with_cwd(params.cwd, |path| git::stash_save(path, params.message, params.include_untracked))
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

fn to_value<T: Serialize>(value: T) -> Result<Value, CommandError> {
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
    Arc::new(move |payload: SessionData| {
        emit_event(&events, "session-data", payload);
    })
}

fn emit_event<T: Serialize>(events: &broadcast::Sender<EventMessage>, event: &str, payload: T) {
    let Ok(value) = serde_json::to_value(payload) else {
        return;
    };
    let _ = events.send(EventMessage {
        event: event.to_string(),
        payload: value,
    });
}

fn acp_event_sink(events: broadcast::Sender<EventMessage>) -> acp::types::AcpEventSink {
    Arc::new(move |event| match event {
        AcpEvent::SessionUpdate(payload) => emit_event(&events, "acp-session-update", payload),
        AcpEvent::ConnectionState(payload) => emit_event(&events, "acp-session-state", payload),
        AcpEvent::PermissionRequest(payload) => {
            emit_event(&events, "acp-permission-request", payload)
        }
    })
}

fn with_cwd<T>(cwd: String, f: impl FnOnce(&std::path::Path) -> Result<T, git::GitError>) -> Result<T, CommandError> {
    let path = PathBuf::from(cwd);
    f(&path).map_err(CommandError::from)
}

fn with_repo_root<T>(repo_root: String, f: impl FnOnce(&std::path::Path) -> Result<T, git::GitError>) -> Result<T, CommandError> {
    let path = PathBuf::from(repo_root);
    f(&path).map_err(CommandError::from)
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
