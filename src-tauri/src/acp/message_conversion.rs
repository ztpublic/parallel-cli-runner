//! Message conversion utilities for AI SDK ↔ ACP protocol
//!
//! This module handles conversion between:
//! - AI SDK message format (used by @ai-sdk/react)
//! - ACP ContentBlock format (used by agent-client-protocol)

use agent_client_protocol::ContentBlock;
use serde_json::{json, Value};

/// Convert AI SDK messages to ACP ContentBlocks
///
/// AI SDK message format:
/// ```json
/// {
///   "role": "user" | "assistant" | "system",
///   "content": string | { "parts": [...] }
/// }
/// ```
///
/// ACP ContentBlock format:
/// ```json
/// {
///   "type": "text",
///   "text": "content"
/// }
/// ```
pub fn ai_messages_to_content_blocks(messages: &[Value]) -> Vec<ContentBlock> {
    messages
        .iter()
        .filter_map(convert_ai_message_to_content_blocks)
        .flatten()
        .collect()
}

/// Convert a single AI SDK message to ACP ContentBlocks
fn convert_ai_message_to_content_blocks(message: &Value) -> Option<Vec<ContentBlock>> {
    let role = message.get("role")?.as_str()?;
    let content = message.get("content")?;

    match role {
        "user" | "system" => {
            // Simple text content
            let text = content.as_str().unwrap_or("");
            Some(vec![text_to_content_block(text)])
        }
        "assistant" => {
            // Assistant messages may have parts or be simple text
            if let Some(parts) = content.get("parts").and_then(|p| p.as_array()) {
                Some(
                    parts
                        .iter()
                        .filter_map(convert_part_to_content_block)
                        .collect(),
                )
            } else if let Some(text) = content.as_str() {
                Some(vec![text_to_content_block(text)])
            } else {
                Some(vec![])
            }
        }
        _ => Some(vec![]),
    }
}

/// Convert an AI SDK message part to ACP ContentBlock
fn convert_part_to_content_block(part: &Value) -> Option<ContentBlock> {
    let part_type = part.get("type")?.as_str()?;

    match part_type {
        "text" => {
            let text = part.get("text")?.as_str().unwrap_or("");
            Some(text_to_content_block(text))
        }
        "tool-call" => {
            // Tool calls are handled differently in ACP
            // For now, represent as text
            let tool_name = part.get("toolName")?.as_str().unwrap_or("unknown");
            let args = part.get("args").and_then(|a| serde_json::to_string(a).ok());
            Some(text_to_content_block(&format!(
                "Tool call: {}({})",
                tool_name,
                args.unwrap_or_default()
            )))
        }
        "tool-result" => {
            // Tool results
            let tool_name = part.get("toolName")?.as_str().unwrap_or("unknown");
            let result = part.get("result")?.as_str().unwrap_or("");
            Some(text_to_content_block(&format!(
                "Tool result from {}: {}",
                tool_name, result
            )))
        }
        _ => {
            // Unknown part type - try to represent as text
            let text = part.get("text").and_then(|t| t.as_str());
            text.map(text_to_content_block)
        }
    }
}

/// Convert a simple user message text to ACP ContentBlock
///
/// This is a convenience function for the common case of a user sending a text prompt.
///
/// ACP ContentBlock JSON format:
/// ```json
/// {
///   "type": "text",
///   "text": "Hello, world!"
/// }
/// ```
pub fn text_to_content_block(text: &str) -> ContentBlock {
    serde_json::from_value(json!({
        "type": "text",
        "text": text
    }))
    .expect("Failed to create ContentBlock from text")
}

/// ACP response chunk for streaming to frontend
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpResponseChunk {
    #[serde(rename = "type")]
    pub chunk_type: String,
    pub text: Option<String>,
    pub metadata: Option<Value>,
}

impl AcpResponseChunk {
    /// Create a text chunk
    pub fn text(text: String) -> Self {
        Self {
            chunk_type: "text".to_string(),
            text: Some(text),
            metadata: None,
        }
    }

    /// Create a metadata/plan chunk
    pub fn metadata(metadata: Value) -> Self {
        Self {
            chunk_type: "metadata".to_string(),
            text: None,
            metadata: Some(metadata),
        }
    }

    /// Create a done chunk
    pub fn done() -> Self {
        Self {
            chunk_type: "done".to_string(),
            text: None,
            metadata: None,
        }
    }
}

/// Convert ACP ContentBlocks to response chunks
///
/// This converts the ACP response format into chunks that can be streamed
/// to the frontend via Tauri events.
///
/// Note: ContentBlock in agent_client_protocol is serialized as JSON.
/// We need to extract the text content from each block.
pub fn acp_response_to_chunks(content_blocks: Vec<ContentBlock>) -> Vec<AcpResponseChunk> {
    let mut chunks = Vec::new();

    for block in content_blocks {
        // Convert ContentBlock to JSON to extract the content
        if let Ok(json_value) = serde_json::to_value(&block) {
            if let Some(text) = extract_text_from_content_block(&json_value) {
                chunks.push(AcpResponseChunk::text(text));
            }
        }
    }

    // Add done marker
    chunks.push(AcpResponseChunk::done());

    chunks
}

/// Extract text content from a ContentBlock JSON value
fn extract_text_from_content_block(value: &Value) -> Option<String> {
    // ContentBlock format: { "type": "text", "text": "..." }
    if let Some(block_type) = value.get("type").and_then(|t| t.as_str()) {
        match block_type {
            "text" => value.get("text").and_then(|t| t.as_str()).map(|s| s.to_string()),
            "thinking" => value.get("text").and_then(|t| t.as_str()).map(|s| format!("Thinking: {}", s)),
            "thinking_silently" => Some("...".to_string()),
            _ => None,
        }
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_to_content_block() {
        let block = text_to_content_block("Hello, world!");
        let json = serde_json::to_value(&block).unwrap();
        assert_eq!(json.get("type").and_then(|t| t.as_str()), Some("text"));
        assert_eq!(
            json.get("text").and_then(|t| t.as_str()),
            Some("Hello, world!")
        );
    }

    #[test]
    fn test_ai_user_message_to_content_blocks() {
        let message = json!({
            "role": "user",
            "content": "What is 2+2?"
        });

        let blocks = convert_ai_message_to_content_blocks(&message).unwrap();
        assert_eq!(blocks.len(), 1);
        let json = serde_json::to_value(&blocks[0]).unwrap();
        assert_eq!(json.get("type").and_then(|t| t.as_str()), Some("text"));
    }

    #[test]
    fn test_ai_assistant_message_to_content_blocks() {
        let message = json!({
            "role": "assistant",
            "content": {
                "parts": [
                    { "type": "text", "text": "The answer is 4." }
                ]
            }
        });

        let blocks = convert_ai_message_to_content_blocks(&message).unwrap();
        assert_eq!(blocks.len(), 1);
    }

    #[test]
    fn test_acp_response_to_chunks() {
        let blocks = vec![
            text_to_content_block("Hello"),
            text_to_content_block(" world"),
        ];

        let chunks = acp_response_to_chunks(blocks);
        assert_eq!(chunks.len(), 3); // 2 text chunks + 1 done chunk
        assert_eq!(chunks[0].chunk_type, "text");
        assert_eq!(chunks[0].text, Some("Hello".to_string()));
        assert_eq!(chunks[2].chunk_type, "done");
    }
}
