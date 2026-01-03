use std::collections::HashMap;
use std::sync::Arc;

use agent_client_protocol::{Implementation, RequestPermissionRequest, SessionNotification};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpAgentConfig {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AcpConnectionStatus {
    Created,
    Initialized,
    Ready,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpConnectionInfo {
    pub id: String,
    pub status: AcpConnectionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_info: Option<Implementation>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpConnectionStateEvent {
    pub connection_id: String,
    pub status: AcpConnectionStatus,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionUpdateEvent {
    pub connection_id: String,
    pub notification: SessionNotification,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpPermissionRequestEvent {
    pub connection_id: String,
    pub request_id: String,
    pub request: RequestPermissionRequest,
}

#[derive(Clone)]
pub enum AcpEvent {
    ConnectionState(AcpConnectionStateEvent),
    SessionUpdate(AcpSessionUpdateEvent),
    PermissionRequest(AcpPermissionRequestEvent),
}

pub type AcpEventSink = Arc<dyn Fn(AcpEvent) + Send + Sync>;
