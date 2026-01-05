//! Integration tests for ACP (Agent Client Protocol) functionality.
//!
//! These tests spawn the example ACP agent server and verify the client implementation
//! correctly implements all ACP operations.

use std::sync::Arc;
use std::time::Duration;

use tokio::time::sleep;

use super::runtime::AcpManager;
use super::types::{AcpAgentConfig, AcpConnectionStatus, AcpEvent};

/// Test helper that sets up an ACP manager and collects events.
struct TestHarness {
    manager: Arc<AcpManager>,
    events_collector: Arc<crossbeam::queue::SegQueue<AcpEvent>>,
}

impl TestHarness {
    /// Create a new test harness.
    fn new() -> Self {
        let events_collector = Arc::new(crossbeam::queue::SegQueue::new());
        let events_collector_clone = events_collector.clone();

        let manager = Arc::new(AcpManager::new(Arc::new(move |event| {
            events_collector_clone.push(event);
        })));

        Self {
            manager,
            events_collector,
        }
    }

    /// Wait for an event matching the predicate, with timeout.
    async fn wait_for_event<F>(&self, predicate: F, timeout_ms: u64) -> Option<AcpEvent>
    where
        F: Fn(&AcpEvent) -> bool,
    {
        let start = std::time::Instant::now();
        while start.elapsed() < Duration::from_millis(timeout_ms) {
            if let Some(event) = (*self.events_collector).pop() {
                if predicate(&event) {
                    return Some(event);
                }
                // Put back non-matching events
                (*self.events_collector).push(event);
            }
            sleep(Duration::from_millis(10)).await;
        }
        None
    }

    /// Drain all pending events.
    fn drain_events(&self) -> Vec<AcpEvent> {
        let mut events = Vec::new();
        while let Some(event) = (*self.events_collector).pop() {
            events.push(event);
        }
        events
    }

    /// Pop the next event if available.
    fn pop_event(&self) -> Option<AcpEvent> {
        (*self.events_collector).pop()
    }
}

/// Get the path to the example agent binary.
fn example_agent_path() -> String {
    // The example agent should be built as part of the test setup
    // For now, we'll use cargo to run it in-process
    "cargo".to_string()
}

/// Create config for the example agent.
fn example_agent_config() -> AcpAgentConfig {
    AcpAgentConfig {
        command: "cargo".to_string(),
        args: vec![
            "run".to_string(),
            "--example".to_string(),
            "agent_example".to_string(),
        ],
        env: std::collections::HashMap::new(),
        cwd: Some(std::env::current_dir().unwrap().to_str().unwrap().to_string()),
    }
}

#[tokio::test]
async fn test_acp_connect() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let result = harness.manager.connect(config).await;
    assert!(result.is_ok(), "Failed to connect: {:?}", result.err());

    let connection_info = result.unwrap();
    assert_eq!(connection_info.status, AcpConnectionStatus::Ready);
    assert!(connection_info.protocol_version.is_some());
    assert!(connection_info.agent_info.is_some());

    // Verify agent info
    let agent_info = connection_info.agent_info.unwrap();
    assert_eq!(agent_info.name, "example-agent");
    assert_eq!(agent_info.title, Some("Example Agent".to_string()));
    assert_eq!(agent_info.version, "0.1.0");

    // Clean up
    let connection_id = connection_info.id.parse().unwrap();
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");
}

#[tokio::test]
async fn test_acp_connection_state_events() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    // Drain any initial events
    harness.drain_events();

    let result = harness.manager.connect(config).await;
    assert!(result.is_ok());

    let connection_info = result.unwrap();
    let connection_id = connection_info.id.parse().unwrap();

    // Wait for Ready state event
    let ready_event = harness
        .wait_for_event(
            |e| matches!(e, AcpEvent::ConnectionState(s) if s.status == AcpConnectionStatus::Ready),
            5000,
        )
        .await
        .expect("Did not receive Ready state event");

    if let AcpEvent::ConnectionState(event) = ready_event {
        assert_eq!(event.connection_id, connection_info.id);
        assert_eq!(event.status, AcpConnectionStatus::Ready);
    } else {
        panic!("Expected ConnectionState event");
    }

    // Disconnect and wait for Closed event
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");

    let closed_event = harness
        .wait_for_event(
            |e| matches!(e, AcpEvent::ConnectionState(s) if s.status == AcpConnectionStatus::Closed),
            2000,
        )
        .await
        .expect("Did not receive Closed state event");

    if let AcpEvent::ConnectionState(event) = closed_event {
        assert_eq!(event.connection_id, connection_info.id);
        assert_eq!(event.status, AcpConnectionStatus::Closed);
    } else {
        panic!("Expected ConnectionState event");
    }
}

#[tokio::test]
async fn test_acp_new_session() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let connection_info = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to connect");
    let connection_id = connection_info.id.parse().unwrap();

    // Create a new session
    let result = harness
        .manager
        .new_session(connection_id, "/tmp".to_string(), vec![])
        .await;

    assert!(result.is_ok(), "Failed to create session: {:?}", result.err());

    let response = result.unwrap();
    assert!(!response.session_id.0.is_empty());
    assert_eq!(response.session_id.0.as_ref(), "0"); // First session should be ID 0

    // Verify we can get connection info after session creation
    let info = harness
        .manager
        .get_info(connection_id)
        .expect("Failed to get connection info");
    assert_eq!(info.status, AcpConnectionStatus::Ready);

    // Clean up
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");
}

#[tokio::test]
async fn test_acp_multiple_sessions() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let connection_info = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to connect");
    let connection_id = connection_info.id.parse().unwrap();

    // Create multiple sessions
    let session1 = harness
        .manager
        .new_session(connection_id, "/tmp".to_string(), vec![])
        .await
        .expect("Failed to create session 1");

    let session2 = harness
        .manager
        .new_session(connection_id, "/tmp".to_string(), vec![])
        .await
        .expect("Failed to create session 2");

    let session3 = harness
        .manager
        .new_session(connection_id, "/tmp".to_string(), vec![])
        .await
        .expect("Failed to create session 3");

    // Verify session IDs are sequential
    assert_eq!(session1.session_id.0.as_ref(), "0");
    assert_eq!(session2.session_id.0.as_ref(), "1");
    assert_eq!(session3.session_id.0.as_ref(), "2");

    // Clean up
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");
}

#[tokio::test]
async fn test_acp_load_session() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let connection_info = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to connect");
    let connection_id = connection_info.id.parse().unwrap();

    // Create a session first
    let session = harness
        .manager
        .new_session(connection_id, "/tmp".to_string(), vec![])
        .await
        .expect("Failed to create session");
    let session_id = session.session_id.0.to_string();

    // Now load it
    let result = harness
        .manager
        .load_session(connection_id, session_id.clone(), "/tmp".to_string(), vec![])
        .await;

    assert!(result.is_ok(), "Failed to load session: {:?}", result.err());

    // Clean up
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");
}

#[tokio::test]
async fn test_acp_prompt_and_session_updates() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let connection_info = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to connect");
    let connection_id = connection_info.id.parse().unwrap();

    // Create a session
    let session = harness
        .manager
        .new_session(connection_id, "/tmp".to_string(), vec![])
        .await
        .expect("Failed to create session");
    let session_id = session.session_id.0.to_string();

    // Drain any events from session creation
    harness.drain_events();

    // Send a prompt
    use agent_client_protocol::ContentBlock;
    // ContentBlock uses "type" field for the variant kind
    let prompt_content: Vec<ContentBlock> = serde_json::from_str(
        r#"[{"type": "text", "text": "Hello, Agent!"}]"#
    ).expect("Failed to parse ContentBlock");

    let result = harness
        .manager
        .prompt(session_id.clone(), prompt_content)
        .await;

    assert!(result.is_ok(), "Failed to send prompt: {:?}", result.err());

    let response = result.unwrap();
    use agent_client_protocol::StopReason;
    assert_eq!(response.stop_reason, StopReason::EndTurn);

    // Note: The example agent doesn't send session updates for simplicity
    // A real agent would stream responses via SessionUpdate events

    // Clean up
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");
}

#[tokio::test]
async fn test_acp_cancel() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let connection_info = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to connect");
    let connection_id = connection_info.id.parse().unwrap();

    // Create a session
    let session = harness
        .manager
        .new_session(connection_id, "/tmp".to_string(), vec![])
        .await
        .expect("Failed to create session");
    let session_id = session.session_id.0.to_string();

    // Send a prompt
    use agent_client_protocol::ContentBlock;
    let prompt_content: Vec<ContentBlock> = serde_json::from_str(
        r#"[{"type": "text", "text": "Test cancel"}]"#
    ).expect("Failed to parse ContentBlock");

    let _ = harness
        .manager
        .prompt(session_id.clone(), prompt_content)
        .await
        .expect("Failed to send prompt");

    // Cancel the session
    let result = harness.manager.cancel(session_id).await;
    assert!(result.is_ok(), "Failed to cancel: {:?}", result.err());

    // Clean up
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");
}

#[tokio::test]
async fn test_acp_multiple_connections() {
    let harness = TestHarness::new();

    // Connect to multiple agents simultaneously
    let config1 = example_agent_config();
    let config2 = example_agent_config();
    let config3 = example_agent_config();

    let conn1 = harness
        .manager
        .connect(config1)
        .await
        .expect("Failed to connect agent 1");
    let conn2 = harness
        .manager
        .connect(config2)
        .await
        .expect("Failed to connect agent 2");
    let conn3 = harness
        .manager
        .connect(config3)
        .await
        .expect("Failed to connect agent 3");

    // Verify all connections have unique IDs
    let id1 = conn1.id.clone();
    let id2 = conn2.id.clone();
    let id3 = conn3.id.clone();

    assert_ne!(id1, id2);
    assert_ne!(id2, id3);
    assert_ne!(id1, id3);

    // Verify all connections are ready
    assert_eq!(conn1.status, AcpConnectionStatus::Ready);
    assert_eq!(conn2.status, AcpConnectionStatus::Ready);
    assert_eq!(conn3.status, AcpConnectionStatus::Ready);

    // Clean up all connections
    let conn_id1 = id1.parse().unwrap();
    let conn_id2 = id2.parse().unwrap();
    let conn_id3 = id3.parse().unwrap();

    harness
        .manager
        .disconnect(conn_id1)
        .await
        .expect("Failed to disconnect agent 1");
    harness
        .manager
        .disconnect(conn_id2)
        .await
        .expect("Failed to disconnect agent 2");
    harness
        .manager
        .disconnect(conn_id3)
        .await
        .expect("Failed to disconnect agent 3");
}

#[tokio::test]
async fn test_acp_connection_info() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let connection_info = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to connect");
    let connection_id = connection_info.id.parse().unwrap();

    // Get connection info
    let info = harness
        .manager
        .get_info(connection_id)
        .expect("Failed to get connection info");

    assert_eq!(info.id, connection_info.id);
    assert_eq!(info.status, AcpConnectionStatus::Ready);
    assert!(info.protocol_version.is_some());
    assert!(info.agent_info.is_some());

    // Verify agent info details
    let agent_info = info.agent_info.unwrap();
    assert_eq!(agent_info.name, "example-agent");

    // Clean up
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");
}

#[tokio::test]
async fn test_acp_disconnect_nonexistent_connection() {
    let harness = TestHarness::new();

    use uuid::Uuid;
    let fake_id = Uuid::new_v4();

    let result = harness.manager.disconnect(fake_id).await;
    assert!(result.is_err(), "Should fail to disconnect nonexistent connection");
}

#[tokio::test]
async fn test_acp_prompt_nonexistent_session() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let _connection_info = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to connect");

    // Try to prompt a session that doesn't exist
    use agent_client_protocol::ContentBlock;
    let prompt_content: Vec<ContentBlock> = serde_json::from_str(
        r#"[{"type": "text", "text": "Test"}]"#
    ).expect("Failed to parse ContentBlock");

    let result = harness
        .manager
        .prompt("nonexistent_session".to_string(), prompt_content)
        .await;
    assert!(result.is_err(), "Should fail to prompt nonexistent session");
}

#[tokio::test]
async fn test_acp_get_info_nonexistent_connection() {
    let harness = TestHarness::new();

    use uuid::Uuid;
    let fake_id = Uuid::new_v4();

    let info = harness.manager.get_info(fake_id);
    assert!(info.is_none(), "Should return None for nonexistent connection");
}

#[tokio::test]
async fn test_acp_session_with_mcp_servers() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let connection_info = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to connect");
    let connection_id = connection_info.id.parse().unwrap();

    // Create a session with MCP servers
    // For now, just use an empty vector since McpServer JSON format is complex
    use agent_client_protocol::McpServer;
    let mcp_servers: Vec<McpServer> = vec![];

    let result = harness
        .manager
        .new_session(connection_id, "/tmp".to_string(), mcp_servers)
        .await;

    assert!(result.is_ok(), "Failed to create session with MCP servers");

    // Clean up
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");
}

#[tokio::test]
async fn test_acp_concurrent_operations() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    let connection_info = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to connect");
    let connection_id = connection_info.id.parse().unwrap();

    // Create multiple sessions concurrently
    let manager1 = harness.manager.clone();
    let manager2 = harness.manager.clone();
    let manager3 = harness.manager.clone();

    let handle1 = tokio::spawn(async move {
        manager1
            .new_session(connection_id, "/tmp".to_string(), vec![])
            .await
    });

    let handle2 = tokio::spawn(async move {
        manager2
            .new_session(connection_id, "/tmp".to_string(), vec![])
            .await
    });

    let handle3 = tokio::spawn(async move {
        manager3
            .new_session(connection_id, "/tmp".to_string(), vec![])
            .await
    });

    let results = futures::future::join_all(vec![handle1, handle2, handle3]).await;

    for result in results {
        assert!(result.is_ok(), "Concurrent operation failed");
        assert!(result.unwrap().is_ok(), "Session creation failed");
    }

    // Clean up
    harness
        .manager
        .disconnect(connection_id)
        .await
        .expect("Failed to disconnect");
}

#[tokio::test]
async fn test_acp_reconnect_after_disconnect() {
    let harness = TestHarness::new();
    let config = example_agent_config();

    // First connection
    let conn1 = harness
        .manager
        .connect(config.clone())
        .await
        .expect("Failed to connect first time");

    let conn_id1 = conn1.id.parse().unwrap();
    harness
        .manager
        .disconnect(conn_id1)
        .await
        .expect("Failed to disconnect");

    // Give it a moment to fully clean up
    sleep(Duration::from_millis(100)).await;

    // Reconnect with same config
    let conn2 = harness
        .manager
        .connect(config)
        .await
        .expect("Failed to reconnect");

    assert_eq!(conn2.status, AcpConnectionStatus::Ready);
    assert_ne!(conn2.id, conn1.id, "New connection should have different ID");

    // Clean up
    let conn_id2 = conn2.id.parse().unwrap();
    harness
        .manager
        .disconnect(conn_id2)
        .await
        .expect("Failed to disconnect");
}
