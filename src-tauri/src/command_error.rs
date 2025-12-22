use serde::Serialize;

use crate::git;

#[derive(Debug, Clone, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn internal(err: impl ToString) -> Self {
        Self::new("internal", err.to_string())
    }
}

impl From<git::GitError> for CommandError {
    fn from(value: git::GitError) -> Self {
        match value {
            git::GitError::GitNotFound => Self::new("git_not_found", "git not found"),
            git::GitError::GitFailed { code: _, stderr } => Self::new("git_failed", stderr),
            git::GitError::Git2(err) => Self::new("git_failed", err.message()),
            git::GitError::Io(err) => Self::internal(err),
            git::GitError::Utf8(err) => Self::internal(err),
        }
    }
}
