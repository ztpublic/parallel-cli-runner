use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone)]
pub struct EventMessage {
    pub event: String,
    pub payload: Value,
}

#[derive(Clone)]
pub struct WsState {
    pub manager: super::super::pty::PtyManager,
    pub acp: super::super::acp::AcpManager,
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
