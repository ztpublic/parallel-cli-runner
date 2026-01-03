use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::thread;

use anyhow::{anyhow, Context, Result};
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot};
use tokio::task::LocalSet;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};
use uuid::Uuid;

use agent_client_protocol::{
    Agent, Client, ClientCapabilities, ClientSideConnection, Implementation, InitializeRequest,
    InitializeResponse, ProtocolVersion, RequestPermissionOutcome, RequestPermissionRequest,
    RequestPermissionResponse, SessionNotification,
};

use super::types::{AcpAgentConfig, AcpConnectionInfo, AcpConnectionStatus};

#[derive(Clone, Default)]
pub struct AcpManager {
    connections: Arc<Mutex<HashMap<Uuid, AcpConnectionHandle>>>,
}

impl AcpManager {
    pub async fn connect(&self, config: AcpAgentConfig) -> Result<AcpConnectionInfo> {
        let id = Uuid::new_v4();
        let state = Arc::new(Mutex::new(AcpConnectionState::new()));
        let (shutdown_tx, shutdown_rx) = mpsc::unbounded_channel();
        let (ready_tx, ready_rx) = oneshot::channel::<Result<InitializeResponse>>();

        let task_state = state.clone();
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
                local.block_on(&runtime, run_connection(id, config, task_state, shutdown_rx, ready_tx));
            if let Err(err) = result {
                eprintln!("acp connection {id} failed: {err}");
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
                shutdown_tx,
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

        let _ = handle.shutdown_tx.send(AcpCommand::Shutdown);
        let _ = tokio::task::spawn_blocking(move || {
            let _ = handle.join.join();
        })
        .await;
        Ok(())
    }
}

struct AcpConnectionHandle {
    state: Arc<Mutex<AcpConnectionState>>,
    shutdown_tx: mpsc::UnboundedSender<AcpCommand>,
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
}

#[derive(Clone)]
struct AcpClient {
    connection_id: Uuid,
}

#[async_trait::async_trait(?Send)]
impl Client for AcpClient {
    async fn request_permission(
        &self,
        _args: RequestPermissionRequest,
    ) -> agent_client_protocol::Result<RequestPermissionResponse> {
        eprintln!(
            "acp connection {} received permission request before UI wiring",
            self.connection_id
        );
        Ok(RequestPermissionResponse::new(
            RequestPermissionOutcome::Cancelled,
        ))
    }

    async fn session_notification(
        &self,
        _args: SessionNotification,
    ) -> agent_client_protocol::Result<()> {
        Ok(())
    }
}

async fn run_connection(
    id: Uuid,
    config: AcpAgentConfig,
    state: Arc<Mutex<AcpConnectionState>>,
    mut shutdown_rx: mpsc::UnboundedReceiver<AcpCommand>,
    ready_tx: oneshot::Sender<Result<InitializeResponse>>,
) -> Result<()> {
    let mut child = spawn_agent(&config)
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

    let client = AcpClient { connection_id: id };
    let (connection, io_task) = ClientSideConnection::new(
        client,
        stdin.compat_write(),
        stdout.compat(),
        |fut| {
            tokio::task::spawn_local(fut);
        },
    );

    let mut io_handle = tokio::task::spawn_local(async move { io_task.await });

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

    loop {
        tokio::select! {
            cmd = shutdown_rx.recv() => {
                match cmd {
                    Some(AcpCommand::Shutdown) => {
                        let _ = child.kill().await;
                        break;
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
                break;
            }
            io_result = &mut io_handle => {
                match io_result {
                    Ok(Ok(())) => {}
                    Ok(Err(err)) => {
                        if let Ok(mut guard) = state.lock() {
                            guard.set_closed(Some(format!("io task failed: {err}")));
                        }
                    }
                    Err(err) => {
                        if let Ok(mut guard) = state.lock() {
                            guard.set_closed(Some(format!("io task join failed: {err}")));
                        }
                    }
                }
                break;
            }
        }
    }

    if let Ok(mut guard) = state.lock() {
        if guard.status != AcpConnectionStatus::Closed {
            guard.set_closed(None);
        }
    }

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
                    eprintln!("acp agent {id} stderr: {trimmed}");
                }
            }
            Err(_) => break,
        }
    }
}
