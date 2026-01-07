use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot};
use tokio::task::LocalSet;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};
use uuid::Uuid;

use agent_client_protocol::{
    Agent, CancelNotification, Client, ClientCapabilities, ClientSideConnection, ContentBlock,
    Implementation, InitializeRequest, InitializeResponse, LoadSessionRequest, LoadSessionResponse,
    McpServer, NewSessionRequest, NewSessionResponse, PromptRequest, PromptResponse,
    ProtocolVersion, RequestPermissionOutcome, RequestPermissionRequest, RequestPermissionResponse,
    SessionNotification,
};

use super::types::{
    AcpAgentConfig, AcpConnectionInfo, AcpConnectionStateEvent, AcpConnectionStatus, AcpEvent,
    AcpEventSink, AcpPermissionRequestEvent, AcpSessionUpdateEvent,
};

/// Cache entry for a session with its last access time
#[derive(Clone)]
struct SessionCacheEntry {
    connection_id: Uuid,
    session_id: String,
    last_accessed: Arc<Mutex<Instant>>,
}

impl SessionCacheEntry {
    fn new(connection_id: Uuid, session_id: String) -> Self {
        Self {
            connection_id,
            session_id,
            last_accessed: Arc::new(Mutex::new(Instant::now())),
        }
    }

    fn touch(&self) {
        if let Ok(mut last) = self.last_accessed.lock() {
            *last = Instant::now();
        }
    }

    fn is_stale(&self, timeout: Duration) -> bool {
        self.last_accessed
            .lock()
            .map(|last| last.elapsed() > timeout)
            .unwrap_or(true)
    }
}

#[derive(Clone)]
pub struct AcpManager {
    connections: Arc<Mutex<HashMap<Uuid, AcpConnectionHandle>>>,
    sessions: Arc<Mutex<HashMap<String, Uuid>>>,
    pending_permissions: Arc<Mutex<HashMap<String, oneshot::Sender<RequestPermissionOutcome>>>>,
    event_sink: AcpEventSink,
    /// Session cache for reusing agent sessions
    /// Maps agent config hash -> (connection_id, session_id, last_accessed)
    session_cache: Arc<Mutex<HashMap<String, SessionCacheEntry>>>,
    /// Session timeout - sessions idle longer than this will be cleaned up
    session_timeout: Duration,
}

impl Default for AcpManager {
    fn default() -> Self {
        Self::new(Arc::new(|_| {}))
    }
}

impl AcpManager {
    pub fn new(event_sink: AcpEventSink) -> Self {
        Self::with_timeout(event_sink, Duration::from_secs(300)) // 5 minutes default
    }

    pub fn with_timeout(event_sink: AcpEventSink, session_timeout: Duration) -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            pending_permissions: Arc::new(Mutex::new(HashMap::new())),
            event_sink,
            session_cache: Arc::new(Mutex::new(HashMap::new())),
            session_timeout,
        }
    }

    /// Generate a hash key for an agent configuration
    fn agent_config_key(config: &AcpAgentConfig) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        config.command.hash(&mut hasher);
        config.args.hash(&mut hasher);
        // Note: we don't hash env vars as they may change between calls
        // but same command + args should use the same connection
        format!("{}:{:x}", config.command, hasher.finish())
    }

    /// Get or create a session for the given agent configuration
    ///
    /// This method:
    /// 1. Checks if a cached session exists for this agent config
    /// 2. If yes, returns the cached session (updating its access time)
    /// 3. If no, creates a new connection and session, caches it, and returns it
    pub async fn get_or_create_session(
        &self,
        config: AcpAgentConfig,
        cwd: String,
        mcp_servers: Vec<McpServer>,
    ) -> Result<String> {
        let key = Self::agent_config_key(&config);

        // Check if we have a cached session
        {
            let cache = self.session_cache.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(entry) = cache.get(&key) {
                // Verify the connection is still alive
                if let Some(info) = self.get_info(entry.connection_id) {
                    if info.status == AcpConnectionStatus::Ready {
                        // Touch the entry to update its access time
                        entry.touch();
                        // Return the cached session_id
                        return Ok(entry.session_id.clone());
                    }
                }
                // Connection is dead, remove from cache and continue to create new
                drop(cache);
                self.remove_cached_session(&key);
            }
        }

        // No valid cached session, create a new one
        // First connect to the agent
        let connection_info = self.connect(config.clone()).await?;

        // Create a new session
        let session_response = self
            .new_session(connection_info.id.parse()?, cwd, mcp_servers)
            .await?;

        let session_id = session_response.session_id.to_string();

        // Cache the session
        {
            let mut cache = self
                .session_cache
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            cache.insert(
                key.clone(),
                SessionCacheEntry::new(connection_info.id.parse()?, session_id.clone()),
            );
        }

        Ok(session_id)
    }

    /// Remove a session from the cache
    fn remove_cached_session(&self, key: &str) {
        let mut cache = self.session_cache.lock().unwrap_or_else(|e| e.into_inner());
        cache.remove(key);
    }

    /// Clean up stale sessions from the cache
    ///
    /// This should be called periodically to remove sessions that haven't been used
    /// within the timeout period.
    pub fn cleanup_stale_sessions(&self) {
        let mut cache = self.session_cache.lock().unwrap_or_else(|e| e.into_inner());
        let mut to_remove = Vec::new();

        for (key, entry) in cache.iter() {
            if entry.is_stale(self.session_timeout) {
                to_remove.push(key.clone());
            }
        }

        for key in to_remove {
            if let Some(entry) = cache.remove(&key) {
                // Disconnect the connection associated with this session
                std::mem::drop(self.disconnect(entry.connection_id));
            }
        }
    }

    pub async fn connect(&self, config: AcpAgentConfig) -> Result<AcpConnectionInfo> {
        let id = Uuid::new_v4();
        let state = Arc::new(Mutex::new(AcpConnectionState::new()));
        let (command_tx, command_rx) = mpsc::unbounded_channel();
        let (ready_tx, ready_rx) = oneshot::channel::<Result<InitializeResponse>>();

        let task_state = state.clone();
        let event_sink = self.event_sink.clone();
        let pending_permissions = self.pending_permissions.clone();
        let join = thread::spawn(move || {
            let runtime = match tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
            {
                Ok(runtime) => runtime,
                Err(err) => {
                    let _ = ready_tx.send(Err(anyhow!("failed to start ACP runtime: {err}")));
                    return;
                }
            };

            let local = LocalSet::new();
            let result =
                local.block_on(&runtime, run_connection(
                    id,
                    config,
                    task_state,
                    command_rx,
                    ready_tx,
                    event_sink,
                    pending_permissions,
                ));
            if let Err(err) = result {
                tracing::error!("acp connection {id} failed: {err}");
            }
        });

        let init = ready_rx
            .await
            .context("acp connection initialization channel closed")??;

        let info = {
            let guard = state.lock().unwrap_or_else(|e| e.into_inner());
            guard.snapshot(id, Some(&init))
        };

        self.connections.lock().unwrap_or_else(|e| e.into_inner()).insert(
            id,
            AcpConnectionHandle {
                state,
                command_tx,
                join,
            },
        );

        Ok(info)
    }

    pub fn get_info(&self, id: Uuid) -> Option<AcpConnectionInfo> {
        let guard = self.connections.lock().unwrap_or_else(|e| e.into_inner());
        let handle = guard.get(&id)?;
        let state = handle.state.lock().unwrap_or_else(|e| e.into_inner());
        let init = state.initialize.clone();
        let info = state.snapshot(id, init.as_ref());
        Some(info)
    }

    pub async fn disconnect(&self, id: Uuid) -> Result<()> {
        let handle = self
            .connections
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&id)
            .ok_or_else(|| anyhow!("acp connection {id} not found"))?;

        let _ = handle.command_tx.send(AcpCommand::Shutdown);
        let _ = tokio::task::spawn_blocking(move || {
            let _ = handle.join.join();
        })
        .await;
        Ok(())
    }

    pub async fn new_session(
        &self,
        connection_id: Uuid,
        cwd: String,
        mcp_servers: Vec<McpServer>,
    ) -> Result<NewSessionResponse> {
        let command_tx = self.get_command_tx(connection_id)?;
        let request = NewSessionRequest::new(cwd).mcp_servers(mcp_servers);
        let response = send_request(&command_tx, |respond_to| AcpCommand::NewSession {
            request,
            respond_to,
        })
        .await?;

        if let Ok(mut guard) = self.sessions.lock() {
            guard.insert(response.session_id.to_string(), connection_id);
        }

        Ok(response)
    }

    pub async fn load_session(
        &self,
        connection_id: Uuid,
        session_id: String,
        cwd: String,
        mcp_servers: Vec<McpServer>,
    ) -> Result<LoadSessionResponse> {
        let command_tx = self.get_command_tx(connection_id)?;
        let request = LoadSessionRequest::new(session_id.clone(), cwd).mcp_servers(mcp_servers);
        let response = send_request(&command_tx, |respond_to| AcpCommand::LoadSession {
            request,
            respond_to,
        })
        .await?;

        if let Ok(mut guard) = self.sessions.lock() {
            guard.insert(session_id, connection_id);
        }

        Ok(response)
    }

    pub async fn prompt(
        &self,
        session_id: String,
        prompt: Vec<ContentBlock>,
    ) -> Result<PromptResponse> {
        let connection_id = self.connection_for_session(&session_id)?;
        let command_tx = self.get_command_tx(connection_id)?;
        let request = PromptRequest::new(session_id, prompt);
        send_request(&command_tx, |respond_to| AcpCommand::Prompt { request, respond_to }).await
    }

    pub async fn cancel(&self, session_id: String) -> Result<()> {
        let connection_id = self.connection_for_session(&session_id)?;
        let command_tx = self.get_command_tx(connection_id)?;
        let request = CancelNotification::new(session_id);
        send_request(&command_tx, |respond_to| AcpCommand::Cancel { request, respond_to }).await
    }

    pub fn reply_permission(
        &self,
        request_id: String,
        outcome: RequestPermissionOutcome,
    ) -> Result<()> {
        let sender = {
            let mut guard = self
                .pending_permissions
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            guard.remove(&request_id)
        };
        if let Some(sender) = sender {
            let _ = sender.send(outcome);
            return Ok(());
        }
        Err(anyhow!("permission request {request_id} not found"))
    }

    fn get_command_tx(&self, id: Uuid) -> Result<mpsc::UnboundedSender<AcpCommand>> {
        let guard = self.connections.lock().unwrap_or_else(|e| e.into_inner());
        guard
            .get(&id)
            .map(|handle| handle.command_tx.clone())
            .ok_or_else(|| anyhow!("acp connection {id} not found"))
    }

    fn connection_for_session(&self, session_id: &str) -> Result<Uuid> {
        let guard = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        guard
            .get(session_id)
            .copied()
            .ok_or_else(|| anyhow!("acp session {session_id} not found"))
    }
}

async fn send_request<T>(
    sender: &mpsc::UnboundedSender<AcpCommand>,
    build: impl FnOnce(oneshot::Sender<Result<T>>) -> AcpCommand,
) -> Result<T>
where
    T: Send + 'static,
{
    let (tx, rx) = oneshot::channel::<Result<T>>();
    let command = build(tx);
    sender
        .send(command)
        .map_err(|_| anyhow!("acp connection command channel closed"))?;
    rx.await
        .map_err(|_| anyhow!("acp connection command dropped"))?
}

struct AcpConnectionHandle {
    state: Arc<Mutex<AcpConnectionState>>,
    command_tx: mpsc::UnboundedSender<AcpCommand>,
    join: thread::JoinHandle<()>,
}

#[derive(Debug, Clone)]
struct AcpConnectionState {
    status: AcpConnectionStatus,
    initialize: Option<InitializeResponse>,
    last_error: Option<String>,
}

impl AcpConnectionState {
    fn new() -> Self {
        Self {
            status: AcpConnectionStatus::Created,
            initialize: None,
            last_error: None,
        }
    }

    fn set_initialized(&mut self, initialize: InitializeResponse) {
        self.status = AcpConnectionStatus::Initialized;
        self.initialize = Some(initialize);
        self.last_error = None;
    }

    fn set_ready(&mut self) {
        self.status = AcpConnectionStatus::Ready;
    }

    fn set_closed(&mut self, error: Option<String>) {
        self.status = AcpConnectionStatus::Closed;
        self.last_error = error;
    }

    fn snapshot(&self, id: Uuid, init: Option<&InitializeResponse>) -> AcpConnectionInfo {
        let init = init.or(self.initialize.as_ref());
        let (protocol_version, agent_info) = match init {
            Some(response) => (
                Some(response.protocol_version.to_string()),
                response.agent_info.clone(),
            ),
            None => (None, None),
        };
        AcpConnectionInfo {
            id: id.to_string(),
            status: self.status,
            protocol_version,
            agent_info,
        }
    }
}

#[derive(Debug)]
enum AcpCommand {
    Shutdown,
    NewSession {
        request: NewSessionRequest,
        respond_to: oneshot::Sender<Result<NewSessionResponse>>,
    },
    LoadSession {
        request: LoadSessionRequest,
        respond_to: oneshot::Sender<Result<LoadSessionResponse>>,
    },
    Prompt {
        request: PromptRequest,
        respond_to: oneshot::Sender<Result<PromptResponse>>,
    },
    Cancel {
        request: CancelNotification,
        respond_to: oneshot::Sender<Result<()>>,
    },
}

#[derive(Clone)]
struct AcpClient {
    connection_id: Uuid,
    event_sink: AcpEventSink,
    pending_permissions: Arc<Mutex<HashMap<String, oneshot::Sender<RequestPermissionOutcome>>>>,
}

#[async_trait::async_trait(?Send)]
impl Client for AcpClient {
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> agent_client_protocol::Result<RequestPermissionResponse> {
        let request_id = Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel::<RequestPermissionOutcome>();
        if let Ok(mut guard) = self.pending_permissions.lock() {
            guard.insert(request_id.clone(), tx);
        }

        (self.event_sink)(AcpEvent::PermissionRequest(AcpPermissionRequestEvent {
            connection_id: self.connection_id.to_string(),
            request_id: request_id.clone(),
            request: args.clone(),
        }));

        let outcome = match rx.await {
            Ok(outcome) => outcome,
            Err(_) => RequestPermissionOutcome::Cancelled,
        };

        if let Ok(mut guard) = self.pending_permissions.lock() {
            guard.remove(&request_id);
        }

        Ok(RequestPermissionResponse::new(outcome))
    }

    async fn session_notification(
        &self,
        args: SessionNotification,
    ) -> agent_client_protocol::Result<()> {
        (self.event_sink)(AcpEvent::SessionUpdate(AcpSessionUpdateEvent {
            connection_id: self.connection_id.to_string(),
            notification: args,
        }));
        Ok(())
    }
}

/// Initialize an ACP agent connection by spawning the agent process and establishing protocol handshake.
///
/// Returns the initialized connection and child process, or an error if initialization fails.
async fn initialize_agent_connection(
    id: Uuid,
    config: &AcpAgentConfig,
    state: &Arc<Mutex<AcpConnectionState>>,
    ready_tx: oneshot::Sender<Result<InitializeResponse>>,
    event_sink: &AcpEventSink,
    pending_permissions: &Arc<Mutex<HashMap<String, oneshot::Sender<RequestPermissionOutcome>>>>,
) -> Result<(ClientSideConnection, tokio::process::Child)> {
    let mut child = spawn_agent(config)
        .with_context(|| format!("failed to spawn ACP agent {}", config.command))?;

    let stdout = child
        .stdout
        .take()
        .context("ACP agent stdout was not captured")?;
    let stdin = child
        .stdin
        .take()
        .context("ACP agent stdin was not captured")?;
    let stderr = child.stderr.take();

    if let Some(stderr) = stderr {
        tokio::task::spawn_local(async move {
            log_stderr(id, stderr).await;
        });
    }

    let client = AcpClient {
        connection_id: id,
        event_sink: event_sink.clone(),
        pending_permissions: pending_permissions.clone(),
    };
    let (connection, io_task) = ClientSideConnection::new(
        client,
        stdin.compat_write(),
        stdout.compat(),
        |fut| {
            tokio::task::spawn_local(fut);
        },
    );

    let io_handle = tokio::task::spawn_local(io_task);

    let init_request = InitializeRequest::new(ProtocolVersion::LATEST)
        .client_capabilities(ClientCapabilities::default())
        .client_info(
            Implementation::new("parallel-cli-runner", env!("CARGO_PKG_VERSION"))
                .title("Parallel CLI Runner"),
        );

    let init_response = match connection.initialize(init_request).await {
        Ok(response) => response,
        Err(err) => {
            let _ = ready_tx.send(Err(anyhow!("initialize failed: {err:?}")));
            if let Ok(mut guard) = state.lock() {
                guard.set_closed(Some(format!("initialize failed: {err:?}")));
            }
            let _ = child.kill().await;
            return Err(anyhow!("initialize failed: {err:?}"));
        }
    };

    if init_response.protocol_version != ProtocolVersion::LATEST {
        let message = format!(
            "agent protocol {} unsupported (client supports {})",
            init_response.protocol_version,
            ProtocolVersion::LATEST
        );
        let _ = ready_tx.send(Err(anyhow!(message.clone())));
        if let Ok(mut guard) = state.lock() {
            guard.set_closed(Some(message));
        }
        let _ = child.kill().await;
        return Err(anyhow!("unsupported protocol version"));
    }

    if let Ok(mut guard) = state.lock() {
        guard.set_initialized(init_response.clone());
        guard.set_ready();
    }

    let _ = ready_tx.send(Ok(init_response));
    (event_sink)(AcpEvent::ConnectionState(AcpConnectionStateEvent {
        connection_id: id.to_string(),
        status: AcpConnectionStatus::Ready,
    }));

    // Note: io_handle needs to be kept alive for the connection to work
    // We'll return it wrapped in the connection or manage it differently
    // For now, we'll just detach it and the cleanup will handle it
    tokio::task::spawn_local(async move {
        let _ = io_handle.await;
    });

    Ok((connection, child))
}

/// Run the main command loop for an ACP agent connection.
///
/// Processes commands from the channel until shutdown, process exit, or IO failure.
async fn run_command_loop(
    connection: &mut ClientSideConnection,
    mut command_rx: mpsc::UnboundedReceiver<AcpCommand>,
    child: &mut tokio::process::Child,
    state: &Arc<Mutex<AcpConnectionState>>,
) -> bool {
    let mut child_exited = false;

    while !child_exited {
        tokio::select! {
            cmd = command_rx.recv() => {
                match cmd {
                    Some(AcpCommand::Shutdown) => {
                        break;
                    }
                    Some(AcpCommand::NewSession { request, respond_to }) => {
                        let result = connection.new_session(request).await;
                        let _ = respond_to.send(result.map_err(|err| anyhow!("session/new failed: {err:?}")));
                    }
                    Some(AcpCommand::LoadSession { request, respond_to }) => {
                        let result = connection.load_session(request).await;
                        let _ = respond_to.send(result.map_err(|err| anyhow!("session/load failed: {err:?}")));
                    }
                    Some(AcpCommand::Prompt { request, respond_to }) => {
                        let result = connection.prompt(request).await;
                        let _ = respond_to.send(result.map_err(|err| anyhow!("session/prompt failed: {err:?}")));
                    }
                    Some(AcpCommand::Cancel { request, respond_to }) => {
                        let result = connection.cancel(request).await;
                        let _ = respond_to.send(result.map_err(|err| anyhow!("session/cancel failed: {err:?}")));
                    }
                    None => break,
                }
            }
            status = child.wait() => {
                if let Err(err) = status {
                    if let Ok(mut guard) = state.lock() {
                        guard.set_closed(Some(format!("agent exited: {err}")));
                    }
                }
                child_exited = true;
            }
        }
    }

    child_exited
}

/// Shutdown an ACP agent connection gracefully.
fn shutdown_connection(
    state: &Arc<Mutex<AcpConnectionState>>,
    event_sink: &AcpEventSink,
    connection_id: Uuid,
) {
    if let Ok(mut guard) = state.lock() {
        if guard.status != AcpConnectionStatus::Closed {
            guard.set_closed(None);
        }
    }
    (event_sink)(AcpEvent::ConnectionState(AcpConnectionStateEvent {
        connection_id: connection_id.to_string(),
        status: AcpConnectionStatus::Closed,
    }));
}

async fn run_connection(
    id: Uuid,
    config: AcpAgentConfig,
    state: Arc<Mutex<AcpConnectionState>>,
    command_rx: mpsc::UnboundedReceiver<AcpCommand>,
    ready_tx: oneshot::Sender<Result<InitializeResponse>>,
    event_sink: AcpEventSink,
    pending_permissions: Arc<Mutex<HashMap<String, oneshot::Sender<RequestPermissionOutcome>>>>,
) -> Result<()> {
    // Initialize the agent connection
    let (mut connection, mut child) = initialize_agent_connection(
        id,
        &config,
        &state,
        ready_tx,
        &event_sink,
        &pending_permissions,
    )
    .await?;

    // Run the command processing loop
    run_command_loop(&mut connection, command_rx, &mut child, &state).await;

    // Kill the child process on shutdown
    let _ = child.kill().await;

    // Perform cleanup and emit close event
    shutdown_connection(&state, &event_sink, id);

    Ok(())
}

fn spawn_agent(config: &AcpAgentConfig) -> Result<tokio::process::Child> {
    let mut command = Command::new(&config.command);
    command
        .args(&config.args)
        .envs(&config.env)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(cwd) = &config.cwd {
        command.current_dir(cwd);
    }

    command
        .spawn()
        .map_err(|err| anyhow!("failed to spawn ACP agent {}: {err}", config.command))
}

async fn log_stderr(id: Uuid, stderr: tokio::process::ChildStderr) {
    let mut reader = tokio::io::BufReader::new(stderr);
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim_end();
                if !trimmed.is_empty() {
                    tracing::warn!("acp agent {id} stderr: {trimmed}");
                }
            }
            Err(_) => break,
        }
    }
}
