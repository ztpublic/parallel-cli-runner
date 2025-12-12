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
) -> Result<String, String> {
    let shell = cmd.unwrap_or_else(default_shell);
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut command = CommandBuilder::new(shell);
    command.env("TERM", "xterm-256color");
    if let Some(dir) = cwd {
        command.cwd(dir);
    }

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|e| e.to_string())?;

    let session_id = Uuid::new_v4();
    manager.insert(
        session_id,
        Arc::new(PtySession::new(pair.master, writer, child)),
    );
    spawn_reader_loop(app, session_id, reader);

    Ok(session_id.to_string())
}

#[tauri::command]
async fn write_to_session(
    manager: State<'_, PtyManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    let session_id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let Some(session) = manager.get(&session_id) else {
        return Err("session not found".into());
    };

    session.write(&data).map_err(|e| e.to_string())
}

#[tauri::command]
async fn resize_session(
    manager: State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let session_id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let Some(session) = manager.get(&session_id) else {
        return Err("session not found".into());
    };

    session.resize(cols, rows).map_err(|e| e.to_string())
}

#[tauri::command]
async fn kill_session(manager: State<'_, PtyManager>, id: String) -> Result<(), String> {
    let session_id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let Some(session) = manager.remove(&session_id) else {
        return Err("session not found".into());
    };

    session.kill().map_err(|e| e.to_string())
}

#[tauri::command]
async fn broadcast_line(
    manager: State<'_, PtyManager>,
    session_ids: Vec<String>,
    line: String,
) -> Result<(), String> {
    for id in session_ids {
        let Ok(session_id) = Uuid::parse_str(&id) else {
            continue;
        };
        if let Some(session) = manager.get(&session_id) {
            session.write(&line).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn git_detect_repo(cwd: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(cwd);
    git::detect_repo(&path)
        .map(|opt| opt.map(|p| p.to_string_lossy().to_string()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_status(cwd: String) -> Result<RepoStatusDto, String> {
    let path = PathBuf::from(cwd);
    git::status(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_diff(cwd: String, pathspecs: Vec<String>) -> Result<String, String> {
    let path = PathBuf::from(cwd);
    git::diff(&path, &pathspecs).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_list_branches(cwd: String) -> Result<Vec<git::BranchInfoDto>, String> {
    let path = PathBuf::from(cwd);
    git::list_branches(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn git_commit(
    cwd: String,
    message: String,
    stage_all: bool,
    amend: bool,
) -> Result<(), String> {
    let path = PathBuf::from(cwd);
    git::commit(&path, &message, stage_all, amend).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_agent(
    manager: State<'_, AgentManager>,
    repo_root: String,
    name: String,
    start_command: String,
    base_branch: Option<String>,
) -> Result<Agent, String> {
    agent::create_agent(&manager, repo_root, name, start_command, base_branch)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_agents(
    manager: State<'_, AgentManager>,
    repo_root: String,
) -> Result<Vec<Agent>, String> {
    let path = PathBuf::from(repo_root);
    manager.load_repo_agents(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn cleanup_agents(
    manager: State<'_, AgentManager>,
    repo_root: String,
) -> Result<(), String> {
    agent::cleanup_agents(&manager, repo_root).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn agent_diff_stats(
    manager: State<'_, AgentManager>,
    repo_root: String,
) -> Result<Vec<AgentDiffStat>, String> {
    agent::agent_diff_stats(&manager, repo_root).map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_agent(
    manager: State<'_, AgentManager>,
    repo_root: String,
    agent_id: String,
) -> Result<(), String> {
    agent::remove_agent(&manager, repo_root, agent_id).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn open_diff_between_refs(
    worktree_path: String,
    path: Option<String>,
) -> Result<(), String> {
    let worktree = PathBuf::from(worktree_path);
    git::difftool(&worktree, path.as_deref()).map_err(|e| e.to_string())
}

fn spawn_reader_loop(app: AppHandle, session_id: Uuid, mut reader: Box<dyn Read + Send>) {
    tauri::async_runtime::spawn_blocking(move || {
        let mut buf = [0u8; 2048];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let payload = SessionData {
                        id: session_id.to_string(),
                        data: chunk,
                    };
                    let _ = app.emit("session-data", payload);
                }
                Err(_) => break,
            }
        }
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
