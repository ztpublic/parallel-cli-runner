use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;
use agent_client_protocol::{
    ContentBlock, McpServer, PermissionOptionId, RequestPermissionOutcome, SelectedPermissionOutcome,
};

use crate::command_error::CommandError;
use crate::acp::{self, AcpManager, AcpResponseChunk, ai_messages_to_content_blocks};
use crate::acp::types::{AcpAgentConfig, AcpConnectionInfo};

/// ACP chat request from the AI SDK frontend
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpChatRequest {
    messages: serde_json::Value,
    agent: AcpAgentConfig,
    env_vars: std::collections::HashMap<String, String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpConnectionIdParams {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionNewParams {
    connection_id: String,
    cwd: String,
    mcp_servers: Option<Vec<McpServer>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionLoadParams {
    connection_id: String,
    session_id: String,
    cwd: String,
    mcp_servers: Option<Vec<McpServer>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionPromptParams {
    session_id: String,
    prompt: Vec<ContentBlock>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionCancelParams {
    session_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpPermissionReplyParams {
    request_id: String,
    outcome: AcpPermissionOutcomeDto,
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

/// Response containing the stream ID for the ACP chat
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpChatResponse {
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
pub async fn acp_chat(
    app: AppHandle,
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
pub async fn acp_connect(
    app: AppHandle,
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
pub async fn acp_disconnect(
    app: AppHandle,
    params: AcpConnectionIdParams,
) -> Result<(), CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    let connection_id = super::parse_uuid(&params.id)?;
    if manager.get_info(connection_id).is_none() {
        return Err(CommandError::new("not_found", "acp connection not found"));
    }
    manager
        .disconnect(connection_id)
        .await
        .map_err(|e| CommandError::internal(format!("Failed to disconnect ACP agent: {e}")))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn acp_session_new(
    app: AppHandle,
    params: AcpSessionNewParams,
) -> Result<String, CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    let connection_id = super::parse_uuid(&params.connection_id)?;
    let mcp_servers = params.mcp_servers.unwrap_or_default();
    let response = manager
        .new_session(connection_id, params.cwd, mcp_servers)
        .await
        .map_err(|e| CommandError::internal(format!("Failed to create ACP session: {e}")))?;
    Ok(response.session_id.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn acp_session_load(
    app: AppHandle,
    params: AcpSessionLoadParams,
) -> Result<serde_json::Value, CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    let connection_id = super::parse_uuid(&params.connection_id)?;
    let mcp_servers = params.mcp_servers.unwrap_or_default();
    let response = manager
        .load_session(connection_id, params.session_id, params.cwd, mcp_servers)
        .await
        .map_err(|e| CommandError::internal(format!("Failed to load ACP session: {e}")))?;
    serde_json::to_value(response).map_err(CommandError::internal)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn acp_session_prompt(
    app: AppHandle,
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
pub async fn acp_session_cancel(
    app: AppHandle,
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
pub async fn acp_permission_reply(
    app: AppHandle,
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
pub async fn acp_cleanup_sessions(app: AppHandle) -> Result<(), CommandError> {
    let manager = app.state::<Arc<AcpManager>>().inner().clone();
    manager.cleanup_stale_sessions();
    Ok(())
}
