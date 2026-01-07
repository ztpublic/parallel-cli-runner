use std::{path::{Path, PathBuf}, sync::Mutex};

use crate::command_error::CommandError;
use crate::error::AppResult;

/// Helper function to execute an operation with a working directory path.
///
/// This converts the string path to a PathBuf and executes the function,
/// automatically converting any AppError to CommandError for Tauri.
pub fn with_cwd<T>(cwd: String, f: impl FnOnce(&Path) -> AppResult<T>) -> Result<T, CommandError> {
    let path = PathBuf::from(cwd);
    f(&path).map_err(CommandError::from)
}

/// Helper function to execute an operation with a repository root path.
///
/// Similar to `with_cwd` but specifically for repository root operations.
pub fn with_repo_root<T>(
    repo_root: String,
    f: impl FnOnce(&Path) -> AppResult<T>,
) -> Result<T, CommandError> {
    let path = PathBuf::from(repo_root);
    f(&path).map_err(CommandError::from)
}

/// Helper function to lock a mutex, handling poisoned locks by recovering the inner value.
///
/// This is a common pattern throughout the codebase for handling potentially poisoned mutexes.
pub fn mutex_lock_or_panic<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}
