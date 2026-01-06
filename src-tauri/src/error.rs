//! Centralized error handling for the application.
//!
//! This module provides a unified error handling approach with:
//! - Standardized error codes shared with TypeScript frontend
//! - Structured error context using anyhow
//! - Clear error categories
//! - Better user-facing messages

use serde::Serialize;
use std::collections::HashMap;
use thiserror::Error;

// ============================================================================
// Error Codes - Shared with TypeScript frontend
// ============================================================================

/// Error code constants that are shared between Rust and TypeScript.
/// These should be kept in sync with the frontend error codes.
pub mod codes {
    pub const GIT_NOT_FOUND: &str = "GIT_NOT_FOUND";
    pub const GIT_FAILED: &str = "GIT_FAILED";
    pub const GIT2_ERROR: &str = "GIT2_ERROR";
    pub const IO_ERROR: &str = "IO_ERROR";
    pub const UTF8_ERROR: &str = "UTF8_ERROR";
    pub const INVALID_PATH: &str = "INVALID_PATH";
    pub const NOT_A_REPOSITORY: &str = "NOT_A_REPOSITORY";
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
    pub const PARSE_ERROR: &str = "PARSE_ERROR";
    pub const VALIDATION_ERROR: &str = "VALIDATION_ERROR";
    pub const NOT_FOUND: &str = "NOT_FOUND";
    pub const PERMISSION_DENIED: &str = "PERMISSION_DENIED";
    pub const CONFLICT_ERROR: &str = "CONFLICT_ERROR";
    pub const NETWORK_ERROR: &str = "NETWORK_ERROR";
    pub const TIMEOUT_ERROR: &str = "TIMEOUT_ERROR";
}

// ============================================================================
// Application Error Type
// ============================================================================

/// The main application error type that represents all errors that can occur.
///
/// This uses an enum-based approach with `thiserror` for clean error definitions
/// and automatic conversions from underlying error types.
#[derive(Error, Debug)]
pub enum AppError {
    /// Git executable was not found on the system
    #[error("git not found")]
    GitNotFound,

    /// Git command failed with a non-zero exit code
    #[error("git failed: {stderr}")]
    GitFailed {
        /// Exit code from git (if available)
        code: Option<i32>,
        /// Error output from git
        stderr: String,
    },

    /// Error from libgit2
    #[error("git operation failed: {0}")]
    Git2(#[from] git2::Error),

    /// IO error
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    /// UTF-8 conversion error
    #[error("utf8 error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),

    /// Invalid path provided
    #[error("invalid path: {0}")]
    InvalidPath(String),

    /// Not a git repository
    #[error("not a repository: {0}")]
    NotARepository(String),

    /// Parse error with context
    #[error("parse error: {message}")]
    ParseError {
        /// Error message
        message: String,
        /// Source content that failed to parse (truncated)
        input: Option<String>,
    },

    /// Validation error with field details
    #[error("validation error: {message}")]
    ValidationError {
        /// Error message
        message: String,
        /// Specific field errors
        field_errors: HashMap<String, String>,
    },

    /// Generic internal error
    #[error("internal error: {0}")]
    Internal(String),

    /// Anyhow error for context-rich errors
    #[error("error: {0}")]
    Context(String),
}

impl AppError {
    /// Get the error code for this error.
    pub fn code(&self) -> &'static str {
        match self {
            AppError::GitNotFound => codes::GIT_NOT_FOUND,
            AppError::GitFailed { .. } => codes::GIT_FAILED,
            AppError::Git2(_) => codes::GIT2_ERROR,
            AppError::Io(_) => codes::IO_ERROR,
            AppError::Utf8(_) => codes::UTF8_ERROR,
            AppError::InvalidPath(_) => codes::INVALID_PATH,
            AppError::NotARepository(_) => codes::NOT_A_REPOSITORY,
            AppError::ParseError { .. } => codes::PARSE_ERROR,
            AppError::ValidationError { .. } => codes::VALIDATION_ERROR,
            AppError::Internal(_) => codes::INTERNAL_ERROR,
            AppError::Context(_) => codes::INTERNAL_ERROR,
        }
    }

    /// Get a user-friendly message for this error.
    pub fn user_message(&self) -> String {
        match self {
            AppError::GitNotFound => {
                "Git could not be found on your system. Please install Git to use this feature.".to_string()
            }
            AppError::GitFailed { stderr, .. } => {
                if stderr.contains("permission denied") {
                    "Permission denied. Please check your file permissions.".to_string()
                } else if stderr.contains("conflict") {
                    format!("Git conflict: {}", stderr)
                } else {
                    stderr.clone()
                }
            }
            AppError::Git2(err) => {
                match err.class() {
                    git2::ErrorClass::Repository => {
                        "Repository error. Please ensure you're in a valid Git repository.".to_string()
                    }
                    git2::ErrorClass::Config => {
                        "Git configuration error. Please check your Git settings.".to_string()
                    }
                    _ => err.message().to_string(),
                }
            }
            AppError::Io(err) => {
                match err.kind() {
                    std::io::ErrorKind::PermissionDenied => {
                        "Permission denied. Please check your file permissions.".to_string()
                    }
                    std::io::ErrorKind::NotFound => {
                        "File or directory not found.".to_string()
                    }
                    _ => err.to_string(),
                }
            }
            AppError::Utf8(err) => {
                format!("Text encoding error: {}", err)
            }
            AppError::InvalidPath(path) => {
                format!("The path '{}' is not valid.", path)
            }
            AppError::NotARepository(path) => {
                format!("The directory '{}' is not a Git repository.", path)
            }
            AppError::ParseError { message, .. } => {
                format!("Failed to parse data: {}", message)
            }
            AppError::ValidationError { message, .. } => {
                message.clone()
            }
            AppError::Internal(msg) => {
                format!("An internal error occurred. Please try again. Details: {}", msg)
            }
            AppError::Context(msg) => {
                msg.clone()
            }
        }
    }

    /// Check if this error is retryable (e.g., transient network issues).
    pub fn is_retryable(&self) -> bool {
        match self {
            AppError::Git2(err) => {
                matches!(
                    err.class(),
                    git2::ErrorClass::Net | git2::ErrorClass::Callback | git2::ErrorClass::Ssl
                )
            }
            AppError::Context(msg) => {
                msg.contains("timeout") || msg.contains("network")
            }
            _ => false,
        }
    }

    /// Create a validation error with field errors.
    pub fn validation(message: impl Into<String>, field_errors: HashMap<String, String>) -> Self {
        AppError::ValidationError {
            message: message.into(),
            field_errors,
        }
    }

    /// Create a parse error.
    pub fn parse(message: impl Into<String>, input: Option<String>) -> Self {
        AppError::ParseError {
            message: message.into(),
            input,
        }
    }
}

// ============================================================================
// Conversions from other error types
// ============================================================================

/// Convert from anyhow::Error (used for context-rich errors)
impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Context(err.to_string())
    }
}

// ============================================================================
// Serializable Error for Frontend
// ============================================================================

/// Serializable error structure that can be sent to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct ErrorResponse {
    /// Error code (matches codes module)
    pub code: String,
    /// User-friendly error message
    pub message: String,
    /// Whether the error is retryable
    #[serde(rename = "isRetryable")]
    pub is_retryable: bool,
    /// Additional context about the error
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl From<&AppError> for ErrorResponse {
    fn from(err: &AppError) -> Self {
        ErrorResponse {
            code: err.code().to_string(),
            message: err.user_message(),
            is_retryable: err.is_retryable(),
            details: Some(err.to_string()),
        }
    }
}

impl From<AppError> for ErrorResponse {
    fn from(err: AppError) -> Self {
        ErrorResponse::from(&err)
    }
}

// ============================================================================
// Command Error (for Tauri commands)
// ============================================================================

/// Error type for Tauri commands that can be serialized and sent to the frontend.
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
        let response: ErrorResponse = (&err).into();
        CommandError {
            code: response.code,
            message: response.message,
        }
    }
}

// ============================================================================
// Result Type Alias
// ============================================================================

/// Standard Result type for the application.
pub type AppResult<T> = Result<T, AppError>;

// ============================================================================
// Error Context Helpers
// ============================================================================

/// Helper trait for adding context to errors.
pub trait ErrorContext<T> {
    /// Add context to an error.
    fn with_context(self, context: impl FnOnce() -> String) -> AppResult<T>;

    /// Add a simple context message to an error.
    fn with_msg(self, msg: &str) -> AppResult<T>;
}

impl<T, E> ErrorContext<T> for Result<T, E>
where
    E: std::error::Error + Send + Sync + 'static,
    AppError: From<E>,
{
    fn with_context(self, context: impl FnOnce() -> String) -> AppResult<T> {
        self.map_err(|e| AppError::Context(format!("{}: {}", context(), e)))
    }

    fn with_msg(self, msg: &str) -> AppResult<T> {
        self.map_err(|e| AppError::Context(format!("{}: {}", msg, e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io;

    #[test]
    fn test_error_codes() {
        let err = AppError::GitNotFound;
        assert_eq!(err.code(), codes::GIT_NOT_FOUND);
    }

    #[test]
    fn test_user_messages() {
        let err = AppError::GitNotFound;
        assert!(err.user_message().contains("Git could not be found"));

        let err = AppError::InvalidPath("/bad/path".to_string());
        assert!(err.user_message().contains("/bad/path"));
    }

    #[test]
    fn test_retryable() {
        // Most errors are not retryable by default
        let err = AppError::GitNotFound;
        assert!(!err.is_retryable());

        // Context errors with timeout/network keywords are retryable
        let err = AppError::Context("network timeout".to_string());
        assert!(err.is_retryable());
    }

    #[test]
    fn test_error_response() {
        let err = AppError::GitNotFound;
        let response: ErrorResponse = (&err).into();

        assert_eq!(response.code, codes::GIT_NOT_FOUND);
        assert!(!response.is_retryable);
        assert!(response.message.contains("Git"));
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = io::Error::new(io::ErrorKind::NotFound, "file not found");
        let app_err: AppError = io_err.into();

        assert_eq!(app_err.code(), codes::IO_ERROR);
        assert!(app_err.user_message().contains("not found"));
    }

    #[test]
    fn test_validation_error() {
        let mut field_errors = HashMap::new();
        field_errors.insert("name".to_string(), "Name is required".to_string());

        let err = AppError::validation("Validation failed", field_errors);
        assert_eq!(err.code(), codes::VALIDATION_ERROR);
        assert!(err.user_message().contains("Validation failed"));
    }
}
