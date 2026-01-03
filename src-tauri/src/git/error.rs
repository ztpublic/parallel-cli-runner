use git2::ErrorCode;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("git not found")]
    GitNotFound,
    #[error("git failed: {stderr}")]
    GitFailed { code: Option<i32>, stderr: String },
    #[error("git2 error: {0}")]
    Git2(#[from] git2::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("utf8 error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
}

pub fn is_missing_ref_error(err: &git2::Error) -> bool {
    err.code() == ErrorCode::NotFound || err.message().contains("reference")
}
