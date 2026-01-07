use serde::Serialize;

use crate::error::{AppError, codes};

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
        Self::new(codes::INTERNAL_ERROR, err.to_string())
    }
}

impl From<AppError> for CommandError {
    fn from(err: AppError) -> Self {
        let code = err.code().to_string();
        let message = err.user_message();
        Self { code, message }
    }
}

// Note: We don't need a separate From<git::GitError> implementation
// because git::GitError is just a type alias for AppError, and the
// From<AppError> implementation already covers it.

