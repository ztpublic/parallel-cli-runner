use crate::git;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskSessionState {
    Active,
    Completed,
    Aborted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Running,
    Finished,
    Winner,
    Discarded,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentWorktree {
    pub agent_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub panel_id: Option<String>,
    pub branch_name: String,
    pub worktree_path: String,
    pub status: AgentStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSession {
    pub id: String,
    pub repo_id: String,
    pub base_branch: String,
    pub base_commit: String,
    pub created_at: String,
    pub state: TaskSessionState,
    pub agents: Vec<AgentWorktree>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentDescriptor {
    pub agent_id: String,
    pub panel_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CleanupMode {
    KeepBranches,
    DeleteBranches,
}

#[derive(Error, Debug)]
pub enum SessionError {
    #[error("not a git repository: {0}")]
    NotGitRepo(String),
    #[error("session not found: {0}")]
    SessionNotFound(String),
    #[error("agent not found: {0}")]
    AgentNotFound(String),
    #[error("branch already exists: {0}")]
    BranchExists(String),
    #[error("worktree already exists at {0}")]
    WorktreeExists(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Git(#[from] git::GitError),
    #[error(transparent)]
    Serde(#[from] serde_json::Error),
    #[error("no agents provided")]
    NoAgents,
}

#[derive(Default, Clone)]
pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, TaskSession>>>,
}

impl SessionManager {
    pub fn insert(&self, session: TaskSession) -> Result<TaskSession, SessionError> {
        self.persist(&session)?;
        let mut guard = self.sessions.lock().expect("session map poisoned");
        guard.insert(session.id.clone(), session.clone());
        Ok(session)
    }

    pub fn get(&self, session_id: &str) -> Option<TaskSession> {
        let guard = self.sessions.lock().expect("session map poisoned");
        guard.get(session_id).cloned()
    }

    pub fn update<F>(&self, session_id: &str, updater: F) -> Result<TaskSession, SessionError>
    where
        F: FnOnce(&mut TaskSession) -> Result<(), SessionError>,
    {
        let mut guard = self.sessions.lock().expect("session map poisoned");
        let session = guard
            .get_mut(session_id)
            .ok_or_else(|| SessionError::SessionNotFound(session_id.to_string()))?;
        updater(session)?;
        let snapshot = session.clone();
        drop(guard);
        self.persist(&snapshot)?;
        Ok(snapshot)
    }

    fn persist(&self, session: &TaskSession) -> Result<(), SessionError> {
        let repo_root = PathBuf::from(&session.repo_id);
        let path = session_meta_path(&repo_root, &session.id);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(session)?;
        fs::write(path, serialized)?;
        Ok(())
    }
}

pub fn create_task_session(
    manager: &SessionManager,
    repo_root: String,
    base_branch: Option<String>,
    agents: Vec<AgentDescriptor>,
) -> Result<TaskSession, SessionError> {
    if agents.is_empty() {
        return Err(SessionError::NoAgents);
    }

    let repo_root = PathBuf::from(repo_root);
    let detected_repo = git::detect_repo(&repo_root)
        .map_err(SessionError::from)?
        .ok_or_else(|| SessionError::NotGitRepo(repo_root.display().to_string()))?;
    let canonical_repo = fs::canonicalize(detected_repo.clone()).unwrap_or(detected_repo);

    let branch = match base_branch {
        Some(branch) => branch,
        None => git::current_branch(&canonical_repo)?,
    };
    let base_commit = git::rev_parse(&canonical_repo, &branch)?;

    let session_id = format!("task-{}", Uuid::new_v4().simple());
    let created_at = Utc::now().to_rfc3339();

    let mut created_agents: Vec<AgentWorktree> = Vec::new();
    let mut slug_counts: HashMap<String, usize> = HashMap::new();
    let worktree_root = worktree_base_dir(&canonical_repo, &session_id);
    for agent in agents {
        let mut slug = slugify(&agent.agent_id);
        let count = slug_counts.entry(slug.clone()).or_insert(0);
        *count += 1;
        if *count > 1 {
            slug = format!("{slug}-{}", count);
        }

        let branch_name = format!("parallel/{}/{}", session_id, slug);
        if git::branch_exists(&canonical_repo, &branch_name)? {
            rollback_worktrees(&canonical_repo, &created_agents);
            return Err(SessionError::BranchExists(branch_name));
        }

        let worktree_path = worktree_root.join(&slug);
        if worktree_path.exists() {
            rollback_worktrees(&canonical_repo, &created_agents);
            return Err(SessionError::WorktreeExists(
                worktree_path.to_string_lossy().to_string(),
            ));
        }

        if let Some(parent) = worktree_path.parent() {
            fs::create_dir_all(parent)?;
        }

        if let Err(err) = git::add_worktree(&canonical_repo, &worktree_path, &branch_name, &branch)
        {
            rollback_worktrees(&canonical_repo, &created_agents);
            return Err(SessionError::from(err));
        }

        created_agents.push(AgentWorktree {
            agent_id: agent.agent_id,
            panel_id: agent.panel_id,
            branch_name,
            worktree_path: worktree_path.to_string_lossy().to_string(),
            status: AgentStatus::Running,
        });
    }

    let session = TaskSession {
        id: session_id,
        repo_id: canonical_repo.to_string_lossy().to_string(),
        base_branch: branch,
        base_commit,
        created_at,
        state: TaskSessionState::Active,
        agents: created_agents,
    };

    manager.insert(session)
}

pub fn finish_agent(
    manager: &SessionManager,
    session_id: &str,
    agent_id: &str,
) -> Result<TaskSession, SessionError> {
    manager.update(session_id, |session| {
        let agent = session
            .agents
            .iter_mut()
            .find(|agent| agent.agent_id == agent_id)
            .ok_or_else(|| SessionError::AgentNotFound(agent_id.to_string()))?;
        agent.status = AgentStatus::Finished;
        Ok(())
    })
}

pub fn choose_winner(
    manager: &SessionManager,
    session_id: &str,
    agent_id: &str,
) -> Result<TaskSession, SessionError> {
    manager.update(session_id, |session| {
        let mut found = false;
        for agent in &mut session.agents {
            if agent.agent_id == agent_id {
                agent.status = AgentStatus::Winner;
                found = true;
            } else if matches!(agent.status, AgentStatus::Running) {
                agent.status = AgentStatus::Finished;
            }
        }

        if !found {
            return Err(SessionError::AgentNotFound(agent_id.to_string()));
        }

        session.state = TaskSessionState::Completed;
        Ok(())
    })
}

pub fn cleanup_session(
    manager: &SessionManager,
    session_id: &str,
    mode: CleanupMode,
) -> Result<TaskSession, SessionError> {
    let session = manager
        .get(session_id)
        .ok_or_else(|| SessionError::SessionNotFound(session_id.to_string()))?;
    let repo_root = PathBuf::from(&session.repo_id);

    for agent in &session.agents {
        let worktree_path = PathBuf::from(&agent.worktree_path);
        let _ = git::remove_worktree(&repo_root, &worktree_path, true);
        if matches!(mode, CleanupMode::DeleteBranches) && agent.status != AgentStatus::Winner {
            let _ = git::delete_branch(&repo_root, &agent.branch_name, true);
        }
    }

    manager.update(session_id, |session| {
        if session.state != TaskSessionState::Completed {
            session.state = TaskSessionState::Aborted;
        }
        for agent in &mut session.agents {
            if agent.status != AgentStatus::Winner {
                agent.status = AgentStatus::Discarded;
            }
        }
        Ok(())
    })
}

fn slugify(raw: &str) -> String {
    let mut out = String::new();
    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    let trimmed = out.trim_matches('-');
    if trimmed.is_empty() {
        "agent".to_string()
    } else {
        trimmed.to_string()
    }
}

fn worktree_base_dir(repo_root: &Path, session_id: &str) -> PathBuf {
    repo_root.join(".parallel-worktrees").join(session_id)
}

fn session_meta_path(repo_root: &Path, session_id: &str) -> PathBuf {
    sessions_dir(repo_root).join(format!("{session_id}.json"))
}

fn sessions_dir(repo_root: &Path) -> PathBuf {
    repo_root.join(".parallel-cli").join("sessions")
}

fn rollback_worktrees(repo_root: &Path, agents: &[AgentWorktree]) {
    for agent in agents {
        let worktree_path = PathBuf::from(&agent.worktree_path);
        let _ = git::remove_worktree(repo_root, &worktree_path, true);
        let _ = git::delete_branch(repo_root, &agent.branch_name, true);
    }
}

impl SessionManager {
    pub fn load_repo_sessions(&self, repo_root: &Path) -> Result<Vec<TaskSession>, SessionError> {
        let canonical_repo =
            fs::canonicalize(repo_root).unwrap_or_else(|_| repo_root.to_path_buf());
        let dir = sessions_dir(&canonical_repo);
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut loaded: Vec<TaskSession> = Vec::new();
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                continue;
            }
            let data = fs::read_to_string(entry.path())?;
            let session: TaskSession = serde_json::from_str(&data)?;
            let session_repo = fs::canonicalize(PathBuf::from(&session.repo_id))
                .unwrap_or_else(|_| PathBuf::from(&session.repo_id));
            if session_repo == canonical_repo {
                loaded.push(session);
            }
        }

        let mut guard = self.sessions.lock().expect("session map poisoned");
        for session in &loaded {
            guard.insert(session.id.clone(), session.clone());
        }

        Ok(loaded)
    }
}
