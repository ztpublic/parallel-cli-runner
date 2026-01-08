use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone)]
pub struct EventMessage {
    pub event: String,
    pub payload: Value,
}

#[derive(Clone)]
pub struct WsState {
    pub manager: crate::pty::PtyManager,
    pub acp: crate::acp::AcpManager,
    pub events: tokio::sync::broadcast::Sender<EventMessage>,
}

#[derive(Deserialize)]
pub struct TransportRequest {
    #[serde(rename = "type")]
    pub kind: String,
    pub id: String,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Serialize)]
pub struct TransportResponse {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<TransportError>,
}

#[derive(Serialize)]
pub struct TransportError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

#[derive(Serialize)]
pub struct TransportEvent {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub event: String,
    pub payload: Value,
}

// Parameter structs for various requests
#[derive(Deserialize)]
pub struct CreateSessionParams {
    pub cmd: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Deserialize)]
pub struct SessionIdParams {
    pub id: String,
}

#[derive(Deserialize)]
pub struct WriteSessionParams {
    pub id: String,
    pub data: String,
}

#[derive(Deserialize)]
pub struct ResizeSessionParams {
    pub id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Deserialize)]
pub struct BroadcastLineParams {
    #[serde(rename = "sessionIds")]
    pub session_ids: Vec<String>,
    pub line: String,
}

#[derive(Deserialize)]
pub struct CwdParams {
    pub cwd: String,
}

#[derive(Deserialize)]
pub struct GitDiffParams {
    pub cwd: String,
    pub pathspecs: Vec<String>,
}

#[derive(Deserialize)]
pub struct GitListCommitsParams {
    pub cwd: String,
    pub limit: usize,
    pub skip: Option<usize>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitListCommitsRangeParams {
    pub cwd: String,
    pub include_branch: String,
    pub exclude_branch: String,
}

#[derive(Deserialize)]
pub struct GitListTagsParams {
    pub cwd: String,
    pub limit: usize,
    pub skip: Option<usize>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitApplyStashParams {
    pub cwd: String,
    pub index: i32,
}

#[derive(Deserialize)]
pub struct GitPushParams {
    pub cwd: String,
    pub force: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitParams {
    pub cwd: String,
    pub message: String,
    pub stage_all: bool,
    pub amend: bool,
}

#[derive(Deserialize)]
pub struct GitStageFilesParams {
    pub cwd: String,
    pub paths: Vec<String>,
}

#[derive(Deserialize)]
pub struct GitResetParams {
    pub cwd: String,
    pub target: String,
    pub mode: String,
}

#[derive(Deserialize)]
pub struct GitRevertParams {
    pub cwd: String,
    pub commit: String,
}

#[derive(Deserialize)]
pub struct GitSquashParams {
    pub cwd: String,
    pub commits: Vec<String>,
}

#[derive(Deserialize)]
pub struct GitCommitsInRemoteParams {
    pub cwd: String,
    pub commits: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitMergeParams {
    pub repo_root: String,
    pub target_branch: String,
    pub source_branch: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRebaseParams {
    pub repo_root: String,
    pub target_branch: String,
    pub onto_branch: String,
}

#[derive(Deserialize)]
pub struct GitCreateBranchParams {
    pub cwd: String,
    pub branch_name: String,
    pub source_branch: Option<String>,
}

#[derive(Deserialize)]
pub struct GitCheckoutBranchParams {
    pub cwd: String,
    #[serde(rename = "branchName")]
    pub branch_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitSmartCheckoutParams {
    pub cwd: String,
    #[serde(rename = "branchName")]
    pub branch_name: String,
}

#[derive(Deserialize)]
pub struct GitStageAllParams {
    pub cwd: String,
}

#[derive(Deserialize)]
pub struct GitUnstageAllParams {
    pub cwd: String,
}

#[derive(Deserialize)]
pub struct GitUnstageFilesParams {
    pub cwd: String,
    pub paths: Vec<String>,
}

#[derive(Deserialize)]
pub struct GitDiscardFilesParams {
    pub cwd: String,
    pub paths: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitAddWorktreeParams {
    pub repo_root: String,
    pub path: String,
    pub branch: String,
    pub start_point: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRemoveWorktreeParams {
    pub repo_root: String,
    pub path: String,
    pub force: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStashSaveParams {
    pub cwd: String,
    pub message: Option<String>,
    pub include_untracked: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDeleteBranchParams {
    pub repo_root: String,
    pub branch: String,
    pub force: bool,
}

#[derive(Deserialize)]
pub struct GitDropStashParams {
    pub cwd: String,
    pub index: i32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDialogParams {
    pub directory: Option<bool>,
    pub multiple: Option<bool>,
    pub title: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPathParams {
    pub path: String,
    pub open_with: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpConnectionIdParams {
    pub id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionNewParams {
    pub connection_id: String,
    pub cwd: String,
    pub mcp_servers: Option<Vec<agent_client_protocol::McpServer>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionLoadParams {
    pub connection_id: String,
    pub session_id: String,
    pub cwd: String,
    pub mcp_servers: Option<Vec<agent_client_protocol::McpServer>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionPromptParams {
    pub session_id: String,
    pub prompt: Vec<agent_client_protocol::ContentBlock>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionCancelParams {
    pub session_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpPermissionReplyParams {
    pub request_id: String,
    pub outcome: AcpPermissionOutcomeDto,
}

#[derive(Deserialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum AcpPermissionOutcomeDto {
    Cancelled,
    Selected {
        #[serde(rename = "optionId")]
        option_id: String,
    },
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpAgentConfigParams {
    pub command: String,
    pub args: Vec<String>,
    pub env: std::collections::HashMap<String, String>,
    #[serde(default)]
    pub cwd: Option<String>,
}
