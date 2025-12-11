use crate::git;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub repo_id: String,
    pub name: String,
    pub branch_name: String,
    pub worktree_path: String,
    pub start_command: String,
}

#[derive(Error, Debug)]
pub enum AgentError {
    #[error("not a git repository: {0}")]
    NotGitRepo(String),
    #[error("agent name is required")]
    NameRequired,
    #[error("starting command is required")]
    CommandRequired,
    #[error("agent not found: {0}")]
    NotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Git(#[from] git::GitError),
    #[error(transparent)]
    Serde(#[from] serde_json::Error),
}

#[derive(Default, Clone)]
pub struct AgentManager {
    agents: Arc<Mutex<HashMap<String, Agent>>>,
}

impl AgentManager {
    pub fn insert(&self, agent: Agent) -> Result<Agent, AgentError> {
        self.persist(&agent)?;
        let mut guard = self.agents.lock().expect("agent map poisoned");
        guard.insert(agent.id.clone(), agent.clone());
        Ok(agent)
    }

    pub fn load_repo_agents(&self, repo_root: &Path) -> Result<Vec<Agent>, AgentError> {
        let canonical_repo =
            fs::canonicalize(repo_root).unwrap_or_else(|_| repo_root.to_path_buf());
        let dir = agents_dir(&canonical_repo);
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut loaded: Vec<Agent> = Vec::new();
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                continue;
            }
            let data = fs::read_to_string(entry.path())?;
            let agent: Agent = serde_json::from_str(&data)?;
            let agent_repo = fs::canonicalize(PathBuf::from(&agent.repo_id))
                .unwrap_or_else(|_| PathBuf::from(&agent.repo_id));
            if agent_repo == canonical_repo {
                loaded.push(agent);
            }
        }

        let mut guard = self.agents.lock().expect("agent map poisoned");
        for agent in &loaded {
            guard.insert(agent.id.clone(), agent.clone());
        }

        Ok(loaded)
    }

    fn persist(&self, agent: &Agent) -> Result<(), AgentError> {
        let repo_root = PathBuf::from(&agent.repo_id);
        let path = agent_meta_path(&repo_root, &agent.id);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(agent)?;
        fs::write(path, serialized)?;
        Ok(())
    }
}

pub fn create_agent(
    manager: &AgentManager,
    repo_root: String,
    name: String,
    start_command: String,
    base_branch: Option<String>,
) -> Result<Agent, AgentError> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err(AgentError::NameRequired);
    }
    let trimmed_command = start_command.trim();
    if trimmed_command.is_empty() {
        return Err(AgentError::CommandRequired);
    }

    let repo_root = PathBuf::from(repo_root);
    let detected_repo = git::detect_repo(&repo_root)
        .map_err(AgentError::from)?
        .ok_or_else(|| AgentError::NotGitRepo(repo_root.display().to_string()))?;
    let canonical_repo = fs::canonicalize(detected_repo.clone()).unwrap_or(detected_repo);
    let branch_start = match base_branch {
        Some(branch) if !branch.trim().is_empty() => branch,
        _ => git::current_branch(&canonical_repo)?,
    };

    let slug = slugify(trimmed_name);
    let (agent_id, branch_name, worktree_path) = reserve_agent_space(&canonical_repo, &slug)?;

    if let Some(parent) = worktree_path.parent() {
        fs::create_dir_all(parent)?;
    }

    git::add_worktree(&canonical_repo, &worktree_path, &branch_name, &branch_start)?;

    let agent = Agent {
        id: agent_id,
        repo_id: canonical_repo.to_string_lossy().to_string(),
        name: trimmed_name.to_string(),
        branch_name,
        worktree_path: worktree_path.to_string_lossy().to_string(),
        start_command: trimmed_command.to_string(),
    };

    manager.insert(agent)
}

pub fn cleanup_agents(manager: &AgentManager, repo_root: String) -> Result<(), AgentError> {
    let repo_root = PathBuf::from(repo_root);
    let detected_repo = git::detect_repo(&repo_root)
        .map_err(AgentError::from)?
        .ok_or_else(|| AgentError::NotGitRepo(repo_root.display().to_string()))?;
    let canonical_repo = fs::canonicalize(detected_repo.clone()).unwrap_or(detected_repo);
    let agents = manager.load_repo_agents(&canonical_repo)?;

    for agent in &agents {
        let worktree_path = PathBuf::from(&agent.worktree_path);
        let _ = git::remove_worktree(&canonical_repo, &worktree_path, true);
        let _ = git::delete_branch(&canonical_repo, &agent.branch_name, true);
        let _ = fs::remove_file(agent_meta_path(&canonical_repo, &agent.id));
        let mut guard = manager.agents.lock().expect("agent map poisoned");
        guard.remove(&agent.id);
    }

    Ok(())
}

pub fn remove_agent(
    manager: &AgentManager,
    repo_root: String,
    agent_id: String,
) -> Result<(), AgentError> {
    let repo_root = PathBuf::from(repo_root);
    let detected_repo = git::detect_repo(&repo_root)
        .map_err(AgentError::from)?
        .ok_or_else(|| AgentError::NotGitRepo(repo_root.display().to_string()))?;
    let canonical_repo = fs::canonicalize(detected_repo.clone()).unwrap_or(detected_repo);
    let agents = manager.load_repo_agents(&canonical_repo)?;
    let agent = agents
        .into_iter()
        .find(|agent| agent.id == agent_id)
        .ok_or_else(|| AgentError::NotFound(agent_id.clone()))?;

    let worktree_path = PathBuf::from(&agent.worktree_path);
    let _ = git::remove_worktree(&canonical_repo, &worktree_path, true);
    let _ = git::delete_branch(&canonical_repo, &agent.branch_name, true);
    let _ = fs::remove_file(agent_meta_path(&canonical_repo, &agent.id));

    if let Ok(mut guard) = manager.agents.lock() {
        guard.remove(&agent.id);
    }

    Ok(())
}

fn reserve_agent_space(repo_root: &Path, slug: &str) -> Result<(String, String, PathBuf), AgentError> {
    loop {
        let agent_id = format!("agent-{}", Uuid::new_v4().simple());
        let short_id = agent_id
            .chars()
            .rev()
            .take(6)
            .collect::<Vec<char>>()
            .into_iter()
            .rev()
            .collect::<String>();

        let branch_name = format!("parallel/agents/{}-{}", slug, short_id);
        let worktree_path = worktree_base_dir(repo_root).join(format!("{slug}-{short_id}"));

        if git::branch_exists(repo_root, &branch_name)? {
            continue;
        }
        if worktree_path.exists() {
            continue;
        }

        return Ok((agent_id, branch_name, worktree_path));
    }
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

fn worktree_base_dir(repo_root: &Path) -> PathBuf {
    repo_root.join(".parallel-worktrees").join("agents")
}

fn agent_meta_path(repo_root: &Path, agent_id: &str) -> PathBuf {
    agents_dir(repo_root).join(format!("{agent_id}.json"))
}

fn agents_dir(repo_root: &Path) -> PathBuf {
    repo_root.join(".parallel-cli").join("agents")
}
