//! A comprehensive ACP agent server demonstrating all major message types.
//!
//! The agent communicates with clients over stdio and demonstrates various
//! ACP protocol features through keyword-triggered scenarios.

use std::cell::Cell;
use std::time::Duration;

use agent_client_protocol::{self as acp, Client as _, SessionId};
use tokio::sync::{mpsc, oneshot};
use tokio_util::compat::{TokioAsyncReadCompatExt as _, TokioAsyncWriteCompatExt as _};

struct ExampleAgent {
    session_update_tx: mpsc::UnboundedSender<(acp::SessionNotification, oneshot::Sender<()>)>,
    next_session_id: Cell<u64>,
}

impl ExampleAgent {
    fn new(
        session_update_tx: mpsc::UnboundedSender<(acp::SessionNotification, oneshot::Sender<()>)>,
    ) -> Self {
        Self {
            session_update_tx,
            next_session_id: Cell::new(0),
        }
    }

    async fn send_session_update(
        &self,
        notification: acp::SessionNotification,
    ) -> Result<(), acp::Error> {
        let (tx, rx) = oneshot::channel();
        self.session_update_tx
            .send((notification, tx))
            .map_err(|_| acp::Error::internal_error())?;
        rx.await.map_err(|_| acp::Error::internal_error())?;
        Ok(())
    }

    fn prompt_text(prompt: &[acp::ContentBlock]) -> String {
        let mut out = String::new();
        for block in prompt {
            if let acp::ContentBlock::Text(text) = block {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push_str(&text.text);
            }
        }
        out
    }

    fn chunk_text(text: &str, max_chars: usize) -> Vec<String> {
        let chars: Vec<char> = text.chars().collect();
        let mut chunks = Vec::new();
        let mut index = 0;
        while index < chars.len() {
            let end = (index + max_chars).min(chars.len());
            chunks.push(chars[index..end].iter().collect());
            index = end;
        }
        chunks
    }

    // Stream text content in chunks
    async fn stream_text(&self, session_id: SessionId, text: &str) -> Result<(), acp::Error> {
        for chunk in Self::chunk_text(text, 18) {
            let notification = acp::SessionNotification::new(
                session_id.clone(),
                acp::SessionUpdate::AgentMessageChunk(acp::ContentChunk::new(
                    acp::ContentBlock::from(chunk),
                )),
            );
            self.send_session_update(notification).await?;
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        Ok(())
    }

    // Send a thought message
    async fn send_thought(&self, session_id: SessionId, text: &str) -> Result<(), acp::Error> {
        let notification = acp::SessionNotification::new(
            session_id,
            acp::SessionUpdate::AgentThoughtChunk(acp::ContentChunk::new(
                acp::ContentBlock::from(text),
            )),
        );
        self.send_session_update(notification).await
    }

    // Send both thought and text response
    async fn think_and_respond(
        &self,
        session_id: SessionId,
        thought: &str,
        response: &str,
    ) -> Result<(), acp::Error> {
        self.send_thought(session_id.clone(), thought).await?;
        tokio::time::sleep(Duration::from_millis(200)).await;
        self.stream_text(session_id, response).await
    }

    // Handle basic text response - demonstrates all frontend-supported message types
    async fn handle_basic_response(
        &self,
        session_id: SessionId,
        prompt_text: &str,
    ) -> Result<acp::StopReason, acp::Error> {
        eprintln!("handle_basic_response: Starting with prompt_text='{}'", prompt_text);

        // 1. Send initial thought/reasoning
        eprintln!("handle_basic_response: Sending thought...");
        self.send_thought(session_id.clone(), "Analyzing your message and planning my response...")
            .await?;
        tokio::time::sleep(Duration::from_millis(300)).await;
        eprintln!("handle_basic_response: Thought sent");

        // 2. Send a plan with multiple steps
        eprintln!("handle_basic_response: Sending plan...");
        let plan_entries = vec![
            acp::PlanEntry::new(
                "Understand user input",
                acp::PlanEntryPriority::High,
                acp::PlanEntryStatus::Completed,
            ),
            acp::PlanEntry::new(
                "Formulate response",
                acp::PlanEntryPriority::High,
                acp::PlanEntryStatus::InProgress,
            ),
            acp::PlanEntry::new(
                "Add example demonstrations",
                acp::PlanEntryPriority::Medium,
                acp::PlanEntryStatus::Pending,
            ),
            acp::PlanEntry::new(
                "Finalize response",
                acp::PlanEntryPriority::Low,
                acp::PlanEntryStatus::Pending,
            ),
        ];
        self.send_session_update(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::Plan(acp::Plan::new(plan_entries)),
        ))
        .await?;
        tokio::time::sleep(Duration::from_millis(300)).await;
        eprintln!("handle_basic_response: Plan sent");

        // 3. Send text response
        eprintln!("handle_basic_response: Sending text response...");
        self.stream_text(
            session_id.clone(),
            &format!("Hello! You said: \"{}\"\n\nI'm demonstrating the ACP protocol message types supported by this frontend:\n\n• Text content (what you're reading now)\n• Reasoning/thinking blocks\n• Execution plans\n• Tool calls with status updates", prompt_text.trim()),
        )
        .await?;
        tokio::time::sleep(Duration::from_millis(300)).await;
        eprintln!("handle_basic_response: Text sent");

        // 4. Demonstrate tool call with a file search simulation
        eprintln!("handle_basic_response: Sending tool call...");
        let tool_call_id = "demo-search-1";
        let tool_call = acp::ToolCall::new(tool_call_id, "Searching for files")
            .kind(acp::ToolKind::Search)
            .status(acp::ToolCallStatus::Pending)
            .raw_input(serde_json::json!({
                "pattern": "*.rs",
                "path": "/Users/zt/projects/parallel-cli-runner-claude-feature/src-tauri/src/acp"
            }));
        self.send_session_update(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCall(tool_call),
        ))
        .await?;
        tokio::time::sleep(Duration::from_millis(400)).await;

        // 5. Update tool call to in-progress
        eprintln!("handle_basic_response: Updating tool call to in-progress...");
        let update_in_progress = acp::ToolCallUpdate::new(
            tool_call_id,
            acp::ToolCallUpdateFields::new().status(acp::ToolCallStatus::InProgress),
        );
        self.send_session_update(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCallUpdate(update_in_progress),
        ))
        .await?;
        tokio::time::sleep(Duration::from_millis(400)).await;

        // 6. Complete tool call with results
        eprintln!("handle_basic_response: Completing tool call...");
        let update_completed = acp::ToolCallUpdate::new(
            tool_call_id,
            acp::ToolCallUpdateFields::new()
                .status(acp::ToolCallStatus::Completed)
                .content(vec![
                    "Found agent_example.rs - A comprehensive demo agent".into(),
                    "Found agent_catalog.rs - Agent catalog implementation".into(),
                    "Found runtime.rs - ACP runtime for managing connections".into(),
                ]),
        );
        self.send_session_update(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCallUpdate(update_completed),
        ))
        .await?;
        tokio::time::sleep(Duration::from_millis(300)).await;
        eprintln!("handle_basic_response: Tool call completed");

        // 7. Final summary text
        eprintln!("handle_basic_response: Sending final summary...");
        self.stream_text(
            session_id,
            "\n\nThat's a demonstration of all the ACP message types currently supported by the frontend! Try typing 'help' to see more specific demonstrations.",
        )
        .await?;
        eprintln!("handle_basic_response: Summary sent");

        eprintln!("handle_basic_response: Returning StopReason::EndTurn");
        Ok(acp::StopReason::EndTurn)
    }

    // Handle help menu - show all available demos
    async fn handle_help_menu(&self, session_id: SessionId) -> Result<acp::StopReason, acp::Error> {
        let help_text = r#"
Welcome to the ACP Demo Agent! I can demonstrate the following ACP protocol features that are supported by the frontend:

[Tool Calls] - Type "tool" or "tools"
   Demonstrates: ToolCall, ToolCallUpdate with status transitions

[Execution Plans] - Type "plan" or "planning"
   Demonstrates: Plan with multiple PlanEntry items

[Stop Reasons] - Type "stop", "max tokens", "refusal", or "cancel"
   Demonstrates: EndTurn, MaxTokens, MaxTurnRequests, Refusal, Cancelled

[Permissions] - Type "permission"
   Demonstrates: session/request_permission flow (educational)

[Basic Demo] - Type any other message
   Demonstrates: All supported message types in a single response (reasoning, plan, text, tool calls)

Try any of these to see the ACP protocol in action!
"#;
        self.stream_text(session_id, help_text).await?;
        Ok(acp::StopReason::EndTurn)
    }

    // Handle tool call demonstration
    async fn handle_tool_demo(&self, session_id: SessionId) -> Result<acp::StopReason, acp::Error> {
        let tool_call_id = "demo-tool-1";

        // 1. Initial thought
        self.send_thought(session_id.clone(), "Planning tool execution...")
            .await?;
        tokio::time::sleep(Duration::from_millis(300)).await;

        // 2. Create and send tool call with Pending status
        let tool_call = acp::ToolCall::new(tool_call_id, "Searching for Rust files")
            .kind(acp::ToolKind::Search)
            .status(acp::ToolCallStatus::Pending)
            .raw_input(serde_json::json!({
                "pattern": "*.rs",
                "path": "/Users/zt/projects/parallel-cli-runner-claude-feature"
            }));

        self.send_session_update(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCall(tool_call),
        ))
        .await?;

        // 3. Update to InProgress
        tokio::time::sleep(Duration::from_millis(500)).await;
        let update = acp::ToolCallUpdate::new(
            tool_call_id,
            acp::ToolCallUpdateFields::new().status(acp::ToolCallStatus::InProgress),
        );
        self.send_session_update(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCallUpdate(update),
        ))
        .await?;

        // 4. Complete with results
        tokio::time::sleep(Duration::from_millis(500)).await;
        let completed_update = acp::ToolCallUpdate::new(
            tool_call_id,
            acp::ToolCallUpdateFields::new()
                .status(acp::ToolCallStatus::Completed)
                .content(vec![
                    "Found 42 Rust files in the project.".into(),
                    "Key files: agent_example.rs, agent_catalog.rs, runtime.rs".into(),
                ]),
        );
        self.send_session_update(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCallUpdate(completed_update),
        ))
        .await?;

        // 5. Summary
        self.stream_text(
            session_id,
            "Tool execution complete! I demonstrated the ToolCall and ToolCallUpdate message types with status transitions: Pending → InProgress → Completed.",
        )
        .await?;

        Ok(acp::StopReason::EndTurn)
    }

    // Handle plan demonstration
    async fn handle_plan_demo(&self, session_id: SessionId) -> Result<acp::StopReason, acp::Error> {
        self.send_thought(session_id.clone(), "Creating execution plan...")
            .await?;
        tokio::time::sleep(Duration::from_millis(300)).await;

        // Define plan entries
        let entries = vec![
            acp::PlanEntry::new(
                "Analyze user requirements",
                acp::PlanEntryPriority::High,
                acp::PlanEntryStatus::Pending,
            ),
            acp::PlanEntry::new(
                "Search for relevant code",
                acp::PlanEntryPriority::High,
                acp::PlanEntryStatus::Pending,
            ),
            acp::PlanEntry::new(
                "Generate implementation plan",
                acp::PlanEntryPriority::Medium,
                acp::PlanEntryStatus::Pending,
            ),
            acp::PlanEntry::new(
                "Write code changes",
                acp::PlanEntryPriority::Medium,
                acp::PlanEntryStatus::Pending,
            ),
            acp::PlanEntry::new(
                "Test and verify",
                acp::PlanEntryPriority::Low,
                acp::PlanEntryStatus::Pending,
            ),
        ];

        // Send initial plan
        self.send_session_update(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::Plan(acp::Plan::new(entries.clone())),
        ))
        .await?;

        // Update each entry progressively
        for i in 0..entries.len() {
            tokio::time::sleep(Duration::from_millis(400)).await;
            let mut updated_entries = entries.clone();
            for j in 0..=i {
                updated_entries[j].status = acp::PlanEntryStatus::Completed;
            }
            if i + 1 < updated_entries.len() {
                updated_entries[i + 1].status = acp::PlanEntryStatus::InProgress;
            }
            self.send_session_update(acp::SessionNotification::new(
                session_id.clone(),
                acp::SessionUpdate::Plan(acp::Plan::new(updated_entries)),
            ))
            .await?;
        }

        // Summary
        self.stream_text(
            session_id,
            "Plan execution complete! I demonstrated the Plan message type with entries progressing through statuses: Pending → InProgress → Completed.",
        )
        .await?;

        Ok(acp::StopReason::EndTurn)
    }

    // Handle stop reason demonstration
    async fn handle_stop_reason_demo(
        &self,
        session_id: SessionId,
        prompt_text: &str,
    ) -> Result<acp::StopReason, acp::Error> {
        let lower = prompt_text.to_lowercase();

        let (message, stop_reason) = if lower.contains("max tokens") || lower.contains("maxtokens") {
            (
                "I've reached the maximum token limit for this response.",
                acp::StopReason::MaxTokens,
            )
        } else if lower.contains("max request") || lower.contains("maxrequest") {
            (
                "I've made the maximum number of allowed requests.",
                acp::StopReason::MaxTurnRequests,
            )
        } else if lower.contains("refusal") {
            (
                "I cannot fulfill this request due to policy constraints.",
                acp::StopReason::Refusal,
            )
        } else if lower.contains("cancel") {
            (
                "The operation has been cancelled.",
                acp::StopReason::Cancelled,
            )
        } else {
            ("Normal completion.", acp::StopReason::EndTurn)
        };

        self.think_and_respond(session_id, "Processing stop reason demo...", message)
            .await?;
        Ok(stop_reason)
    }

    // Handle permission demonstration (educational)
    async fn handle_permission_demo(&self, session_id: SessionId) -> Result<acp::StopReason, acp::Error> {
        self.stream_text(
            session_id.clone(),
            "Permission requests allow agents to request user authorization before performing sensitive operations.\n\n\
             In a real implementation, you would:\n\
             1. Create a ToolCall with the pending operation\n\
             2. Define PermissionOptions (AllowOnce, AllowAlways, RejectOnce, RejectAlways)\n\
             3. Call client.request_permission() with these options\n\
             4. Wait for the user's decision\n\
             5. Proceed based on the outcome\n\n\
             Here's what a permission request structure looks like:",
        )
        .await?;

        // Show the structure as a thought (for educational purposes)
        let demo_json = serde_json::to_string_pretty(&serde_json::json!({
            "toolCall": {
                "toolCallId": "demo-permission-1",
                "title": "Write to file system",
                "status": "pending"
            },
            "permissionOptions": [
                {"optionId": "allow-once", "name": "Allow Once", "kind": "allowOnce"},
                {"optionId": "allow-always", "name": "Allow Always", "kind": "allowAlways"},
                {"optionId": "reject", "name": "Reject", "kind": "rejectOnce"}
            ]
        }))
        .unwrap();

        self.send_thought(session_id.clone(), &demo_json).await?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        self.stream_text(
            session_id,
            "Note: The current agent architecture doesn't have direct access to the Client trait for calling request_permission(). \
             In a production agent, you would store a Client reference to make permission requests.",
        )
        .await?;

        Ok(acp::StopReason::EndTurn)
    }
}

#[async_trait::async_trait(?Send)]
impl acp::Agent for ExampleAgent {
    async fn initialize(
        &self,
        _arguments: acp::InitializeRequest,
    ) -> Result<acp::InitializeResponse, acp::Error> {
        eprintln!("Example agent: Received initialize request");
        use serde_json::json;
        let impl_json = json!({
            "name": "acp-demo-agent",
            "title": "ACP Demo Agent",
            "version": "0.2.0"
        });
        let agent_info: acp::Implementation =
            serde_json::from_value(impl_json).map_err(|_| acp::Error::internal_error())?;

        let mut response = acp::InitializeResponse::new(acp::ProtocolVersion::V1);
        response.agent_info = Some(agent_info);
        Ok(response)
    }

    async fn authenticate(
        &self,
        _arguments: acp::AuthenticateRequest,
    ) -> Result<acp::AuthenticateResponse, acp::Error> {
        eprintln!("Example agent: Received authenticate request");
        Ok(acp::AuthenticateResponse::new())
    }

    async fn new_session(
        &self,
        _arguments: acp::NewSessionRequest,
    ) -> Result<acp::NewSessionResponse, acp::Error> {
        eprintln!("Example agent: Received new session request");
        let session_id = self.next_session_id.get();
        self.next_session_id.set(session_id + 1);
        Ok(acp::NewSessionResponse::new(session_id.to_string()))
    }

    async fn load_session(
        &self,
        _arguments: acp::LoadSessionRequest,
    ) -> Result<acp::LoadSessionResponse, acp::Error> {
        eprintln!("Example agent: Received load session request");
        Ok(acp::LoadSessionResponse::new())
    }

    async fn prompt(
        &self,
        arguments: acp::PromptRequest,
    ) -> Result<acp::PromptResponse, acp::Error> {
        eprintln!(
            "Example agent: Received prompt request with {} content blocks",
            arguments.prompt.len()
        );

        let session_id = arguments.session_id.clone();
        let prompt_text = Self::prompt_text(&arguments.prompt);
        let lower_text = prompt_text.to_lowercase();

        // Route to appropriate scenario based on keywords
        let stop_reason = if lower_text.contains("tool") {
            self.handle_tool_demo(session_id).await?
        } else if lower_text.contains("plan") {
            self.handle_plan_demo(session_id).await?
        } else if lower_text.contains("permission") {
            self.handle_permission_demo(session_id).await?
        } else if lower_text.contains("stop")
            || lower_text.contains("max")
            || lower_text.contains("refusal")
            || lower_text.contains("cancel")
        {
            self.handle_stop_reason_demo(session_id, &lower_text).await?
        } else if lower_text.contains("help") || lower_text.contains("list") {
            self.handle_help_menu(session_id).await?
        } else {
            self.handle_basic_response(session_id, &prompt_text).await?
        };

        eprintln!("prompt: Creating PromptResponse with stop_reason={:?}", stop_reason);
        let response = acp::PromptResponse::new(stop_reason);
        eprintln!("prompt: Returning PromptResponse");
        Ok(response)
    }

    async fn cancel(&self, _args: acp::CancelNotification) -> Result<(), acp::Error> {
        eprintln!("Example agent: Received cancel request");
        Ok(())
    }

    async fn set_session_mode(
        &self,
        _args: acp::SetSessionModeRequest,
    ) -> Result<acp::SetSessionModeResponse, acp::Error> {
        eprintln!("Example agent: Received set session mode request");
        Ok(acp::SetSessionModeResponse::new())
    }

    async fn ext_method(&self, args: acp::ExtRequest) -> Result<acp::ExtResponse, acp::Error> {
        eprintln!(
            "Example agent: Received extension method call: method={}",
            args.method
        );
        use serde_json::value::to_raw_value;
        let empty = to_raw_value(&serde_json::json!({}))?;
        Ok(acp::ExtResponse::new(empty.into()))
    }

    async fn ext_notification(&self, args: acp::ExtNotification) -> Result<(), acp::Error> {
        eprintln!(
            "Example agent: Received extension notification: method={}",
            args.method
        );
        Ok(())
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> acp::Result<()> {
    eprintln!("ACP Demo Agent starting...");

    let outgoing = tokio::io::stdout().compat_write();
    let incoming = tokio::io::stdin().compat();

    let local_set = tokio::task::LocalSet::new();
    local_set
        .run_until(async move {
            let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
            let (conn, handle_io) =
                acp::AgentSideConnection::new(ExampleAgent::new(tx), outgoing, incoming, |fut| {
                    tokio::task::spawn_local(fut);
                });
            tokio::task::spawn_local(async move {
                while let Some((session_notification, tx)) = rx.recv().await {
                    let result = conn.session_notification(session_notification).await;
                    if let Err(e) = result {
                        eprintln!("Demo agent error sending notification: {e}");
                        break;
                    }
                    tx.send(()).ok();
                }
            });
            handle_io.await
        })
        .await
}
