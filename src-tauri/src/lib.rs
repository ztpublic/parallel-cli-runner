use std::{
    collections::HashMap,
    io::{Read, Write},
    path::PathBuf,
    sync::{Arc, Mutex},
};

use anyhow::Context;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

mod command_error;
use crate::command_error::CommandError;

mod git;
use crate::git::RepoStatusDto;
mod agent;
use crate::agent::{Agent, AgentDiffStat, AgentManager};

#[derive(Default, Clone)]
struct PtyManager {
    sessions: Arc<Mutex<HashMap<Uuid, Arc<PtySession>>>>,
}

impl PtyManager {
    fn insert(&self, id: Uuid, session: Arc<PtySession>) {
        let mut guard = self.sessions.lock().expect("sessions poisoned");
        guard.insert(id, session);
    }

    fn remove(&self, id: &Uuid) -> Option<Arc<PtySession>> {
        let mut guard = self.sessions.lock().expect("sessions poisoned");
        guard.remove(id)
    }

    fn get(&self, id: &Uuid) -> Option<Arc<PtySession>> {
        let guard = self.sessions.lock().expect("sessions poisoned");
        guard.get(id).cloned()
    }
}

struct PtySession {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send>>,
}

impl PtySession {
    fn new(
        master: Box<dyn MasterPty + Send>,
        writer: Box<dyn Write + Send>,
        child: Box<dyn Child + Send>,
    ) -> Self {
        Self {
            master: Mutex::new(master),
            writer: Mutex::new(writer),
            child: Mutex::new(child),
        }
    }

    fn write(&self, data: &str) -> anyhow::Result<()> {
        let mut writer = self.writer.lock().expect("writer poisoned");
        writer.write_all(data.as_bytes())?;
        writer.flush()?;
        Ok(())
    }

    fn resize(&self, cols: u16, rows: u16) -> anyhow::Result<()> {
        let master = self.master.lock().expect("master poisoned");
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        master.resize(size)?;
        Ok(())
    }

    fn kill(&self) -> anyhow::Result<()> {
        let mut child = self.child.lock().expect("child poisoned");
        child.kill().context("failed to kill child")
    }
}

#[derive(Clone, Serialize)]
struct SessionData {
    id: String,
    data: String,
}

#[tauri::command]
async fn create_session(
    manager: State<'_, PtyManager>,
    app: AppHandle,
    cmd: Option<String>,
    cwd: Option<String>,
) -> Result<String, CommandError> {
    let shell = cmd.unwrap_or_else(default_shell);
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(CommandError::internal)?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(CommandError::internal)?;
    let writer = pair.master.take_writer().map_err(CommandError::internal)?;
    let mut command = CommandBuilder::new(shell);
    command.env("TERM", "xterm-256color");
    if let Some(dir) = cwd {
        command.cwd(dir);
    }

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(CommandError::internal)?;

    let session_id = Uuid::new_v4();
    manager.insert(
        session_id,
        Arc::new(PtySession::new(pair.master, writer, child)),
    );
    let manager_clone = manager.inner().clone();
    spawn_reader_loop(manager_clone, app, session_id, reader);

    Ok(session_id.to_string())
}

#[tauri::command]
async fn write_to_session(
    manager: State<'_, PtyManager>,
    id: String,
    data: String,
) -> Result<(), CommandError> {
    let session_id = Uuid::parse_str(&id)
        .map_err(|_| CommandError::new("invalid_argument", "invalid session id"))?;
    let Some(session) = manager.get(&session_id) else {
        return Err(CommandError::new("not_found", "session not found"));
    };

    session.write(&data).map_err(CommandError::internal)
}

#[tauri::command]
async fn resize_session(
    manager: State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), CommandError> {
    let session_id = Uuid::parse_str(&id)
        .map_err(|_| CommandError::new("invalid_argument", "invalid session id"))?;
    let Some(session) = manager.get(&session_id) else {
        return Err(CommandError::new("not_found", "session not found"));
    };

    session.resize(cols, rows).map_err(CommandError::internal)
}

#[tauri::command]
async fn kill_session(manager: State<'_, PtyManager>, id: String) -> Result<(), CommandError> {
    let session_id = Uuid::parse_str(&id)
        .map_err(|_| CommandError::new("invalid_argument", "invalid session id"))?;
    let Some(session) = manager.remove(&session_id) else {
        return Err(CommandError::new("not_found", "session not found"));
    };

    session.kill().map_err(CommandError::internal)
}

#[tauri::command]
async fn broadcast_line(
    manager: State<'_, PtyManager>,
    session_ids: Vec<String>,
    line: String,
) -> Result<(), CommandError> {
    for id in session_ids {
        let Ok(session_id) = Uuid::parse_str(&id) else {
            continue;
        };
        if let Some(session) = manager.get(&session_id) {
            session.write(&line).map_err(CommandError::internal)?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn git_detect_repo(cwd: String) -> Result<Option<String>, CommandError> {
    let path = PathBuf::from(cwd);
    git::detect_repo(&path)
        .map(|opt| opt.map(|p| p.to_string_lossy().to_string()))
        .map_err(CommandError::from)
}

#[tauri::command]
async fn git_status(cwd: String) -> Result<RepoStatusDto, CommandError> {
    let path = PathBuf::from(cwd);
    git::status(&path).map_err(CommandError::from)
}

#[tauri::command]
async fn git_diff(cwd: String, pathspecs: Vec<String>) -> Result<String, CommandError> {
    let path = PathBuf::from(cwd);
    git::diff(&path, &pathspecs).map_err(CommandError::from)
}

#[tauri::command]
async fn git_list_branches(cwd: String) -> Result<Vec<git::BranchInfoDto>, CommandError> {
    let path = PathBuf::from(cwd);
    git::list_branches(&path).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_commit(
    cwd: String,
    message: String,
    stage_all: bool,
    amend: bool,
) -> Result<(), CommandError> {
    let path = PathBuf::from(cwd);
    git::commit(&path, &message, stage_all, amend).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn git_merge_into_branch(
    repo_root: String,
    target_branch: String,
    source_branch: String,
) -> Result<(), CommandError> {
    let path = PathBuf::from(repo_root);
    git::merge_into_branch(&path, &target_branch, &source_branch).map_err(CommandError::from)
}

#[tauri::command]
async fn create_agent(
    manager: State<'_, AgentManager>,
    repo_root: String,
    name: String,
    start_command: String,
    base_branch: Option<String>,
) -> Result<Agent, CommandError> {
    agent::create_agent(&manager, repo_root, name, start_command, base_branch)
        .map_err(CommandError::from)
}

#[tauri::command]
async fn list_agents(
    manager: State<'_, AgentManager>,
    repo_root: String,
) -> Result<Vec<Agent>, CommandError> {
    let path = PathBuf::from(repo_root);
    manager.load_repo_agents(&path).map_err(CommandError::from)
}

#[tauri::command]
async fn cleanup_agents(
    manager: State<'_, AgentManager>,
    repo_root: String,
) -> Result<(), CommandError> {
    agent::cleanup_agents(&manager, repo_root).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn agent_diff_stats(
    manager: State<'_, AgentManager>,
    repo_root: String,
) -> Result<Vec<AgentDiffStat>, CommandError> {
    agent::agent_diff_stats(&manager, repo_root).map_err(CommandError::from)
}

#[tauri::command]
async fn remove_agent(
    manager: State<'_, AgentManager>,
    repo_root: String,
    agent_id: String,
) -> Result<(), CommandError> {
    agent::remove_agent(&manager, repo_root, agent_id).map_err(CommandError::from)
}

#[tauri::command(rename_all = "camelCase")]
async fn open_diff_between_refs(
    worktree_path: String,
    path: Option<String>,
) -> Result<(), CommandError> {
    let worktree = PathBuf::from(worktree_path);
    git::difftool(&worktree, path.as_deref()).map_err(CommandError::from)
}

fn spawn_reader_loop(
    manager: PtyManager,
    app: AppHandle,
    session_id: Uuid,
    mut reader: Box<dyn Read + Send>,
) {
    tauri::async_runtime::spawn_blocking(move || {
        let mut buf = [0u8; 2048];
        let mut persistent_buf = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    persistent_buf.extend_from_slice(&buf[..n]);
                    loop {
                        match std::str::from_utf8(&persistent_buf) {
                            Ok(s) => {
                                if !s.is_empty() {
                                    let payload = SessionData {
                                        id: session_id.to_string(),
                                        data: s.to_string(),
                                    };
                                    let _ = app.emit("session-data", payload);
                                }
                                persistent_buf.clear();
                                break;
                            }
                            Err(e) => {
                                let valid_len = e.valid_up_to();
                                if valid_len > 0 {
                                    let s = std::str::from_utf8(&persistent_buf[..valid_len])
                                        .unwrap()
                                        .to_string();
                                    let payload = SessionData {
                                        id: session_id.to_string(),
                                        data: s,
                                    };
                                    let _ = app.emit("session-data", payload);
                                }
                                if let Some(error_len) = e.error_len() {
                                    let payload = SessionData {
                                        id: session_id.to_string(),
                                        data: "".to_string(),
                                    };
                                    let _ = app.emit("session-data", payload);
                                    persistent_buf.drain(0..valid_len + error_len);
                                } else {
                                    persistent_buf.drain(0..valid_len);
                                    break;
                                }
                            }
                        }
                    }
                }
                Err(_) => break,
            }
        }

        // Ensure sessions don't leak when the underlying process exits.
        let _ = manager.remove(&session_id);
    });
}

fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyManager::default())
        .manage(AgentManager::default())
        .invoke_handler(tauri::generate_handler![
            create_session,
            write_to_session,
            resize_session,
            kill_session,
            broadcast_line,
            git_detect_repo,
            git_status,
            git_diff,
            git_list_branches,
            git_commit,
            git_merge_into_branch,
            create_agent,
            list_agents,
            cleanup_agents,
            agent_diff_stats,
            remove_agent,
            open_diff_between_refs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
