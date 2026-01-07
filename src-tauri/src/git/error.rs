//! Git-specific error handling.
//!
//! This module re-exports the centralized error types and provides
//! git-specific error utilities.

use git2::ErrorCode;

/// Re-export the main AppError type for convenience.
pub use crate::error::AppError as GitError;


/// Check if a git2 error is a missing reference error.
///
/// This is useful for handling cases where a reference may not exist yet
/// or may have been deleted.
pub fn is_missing_ref_error(err: &git2::Error) -> bool {
    err.code() == ErrorCode::NotFound || err.message().contains("reference")
}
