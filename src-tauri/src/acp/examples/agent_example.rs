//! A simple ACP agent server for educational purposes.
//!
//! The agent communicates with clients over stdio.

use std::cell::Cell;
use std::time::Duration;

use agent_client_protocol::{self as acp, Client as _};
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
}

#[async_trait::async_trait(?Send)]
impl acp::Agent for ExampleAgent {
    async fn initialize(
        &self,
        _arguments: acp::InitializeRequest,
    ) -> Result<acp::InitializeResponse, acp::Error> {
        eprintln!("Example agent: Received initialize request");
        // Create InitializeResponse with agent_info using JSON deserialization
        use serde_json::json;
        let impl_json = json!({
            "name": "example-agent",
            "title": "Example Agent",
            "version": "0.1.0"
        });
        let agent_info: acp::Implementation = serde_json::from_value(impl_json)
            .map_err(|_| acp::Error::internal_error())?;

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
        eprintln!("Example agent: Received prompt request with {} content blocks", arguments.prompt.len());

        let session_id = arguments.session_id.clone();
        let prompt_text = Self::prompt_text(&arguments.prompt);
        let reply = if prompt_text.trim().is_empty() {
            "Hello from the demo agent.".to_string()
        } else {
            format!("Demo reply: {}", prompt_text.trim())
        };

        let thought_notification = acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::AgentThoughtChunk(acp::ContentChunk::new(
                acp::ContentBlock::from("Composing demo response..."),
            )),
        );
        self.send_session_update(thought_notification).await?;

        for chunk in Self::chunk_text(&reply, 18) {
            let notification = acp::SessionNotification::new(
                session_id.clone(),
                acp::SessionUpdate::AgentMessageChunk(acp::ContentChunk::new(
                    acp::ContentBlock::from(chunk),
                )),
            );
            self.send_session_update(notification).await?;
            tokio::time::sleep(Duration::from_millis(25)).await;
        }

        Ok(acp::PromptResponse::new(acp::StopReason::EndTurn))
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
        // Return an empty JSON object as the response - needs Arc<RawValue>
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
    eprintln!("Example ACP Agent starting...");

    let outgoing = tokio::io::stdout().compat_write();
    let incoming = tokio::io::stdin().compat();

    // The AgentSideConnection will spawn futures onto our Tokio runtime.
    // LocalSet and spawn_local are used because the futures from the
    // agent-client-protocol crate are not Send.
    let local_set = tokio::task::LocalSet::new();
    local_set
        .run_until(async move {
            let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
            // Start up the ExampleAgent connected to stdio.
            let (conn, handle_io) =
                acp::AgentSideConnection::new(ExampleAgent::new(tx), outgoing, incoming, |fut| {
                    tokio::task::spawn_local(fut);
                });
            // Kick off a background task to send the ExampleAgent's session notifications to the client.
            tokio::task::spawn_local(async move {
                while let Some((session_notification, tx)) = rx.recv().await {
                    let result = conn.session_notification(session_notification).await;
                    if let Err(e) = result {
                        eprintln!("Example agent error sending notification: {e}");
                        break;
                    }
                    tx.send(()).ok();
                }
            });
            // Run until stdin/stdout are closed.
            handle_io.await
        })
        .await
}
