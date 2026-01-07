//! Logging infrastructure for the application.
//!
//! Provides dual output to both stdout and log files with configurable levels.

use std::path::{Path, PathBuf};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};

/// Log directory name within the application data directory
const LOG_DIR_NAME: &str = "logs";

/// Default log level when RUST_LOG is not set
const DEFAULT_LOG_LEVEL: &str = "info";

/// Initializes the logging system with both stdout and file output.
///
/// # Arguments
///
/// * `log_dir` - Optional path to a custom log directory. If `None`, uses a default location.
///
/// # Returns
///
/// A `WorkerGuard` that must be kept alive for the duration of the program
/// to ensure logs are flushed. Use `mem::forget(guard)` if you don't need
/// explicit control over when logs are flushed.
///
/// # Example
///
/// ```ignore
/// let guard = init_logging(None);
/// // ... application code ...
/// // guard is dropped here, flushing any remaining logs
/// ```
pub fn init_logging(log_dir: Option<&Path>) -> Option<WorkerGuard> {
    // Determine log level from environment or use default
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(DEFAULT_LOG_LEVEL));

    // Determine log directory
    let log_dir = log_dir.unwrap_or_else(|| Path::new(LOG_DIR_NAME));

    // Create log directory if it doesn't exist
    std::fs::create_dir_all(log_dir).expect("failed to create log directory");

    // Set up file appender with daily rotation
    let file_appender = tracing_appender::rolling::daily(log_dir, "parallel-cli-runner.log");
    let (non_blocking_file, guard) = tracing_appender::non_blocking(file_appender);

    // Set up stdout layer
    let stdout_layer = fmt::layer()
        .with_writer(std::io::stdout)
        .with_ansi(true)
        .with_filter(env_filter.clone());

    // Set up file layer
    let file_layer = fmt::layer()
        .with_writer(non_blocking_file)
        .with_ansi(false)
        .with_filter(env_filter.clone());

    // Combine and initialize subscriber
    tracing_subscriber::registry()
        .with(stdout_layer)
        .with(file_layer)
        .init();

    tracing::info!(
        log_dir = %log_dir.display(),
        "Logging system initialized"
    );

    Some(guard)
}

/// Initializes logging for the WebSocket server mode.
///
/// This is a convenience function that sets up logging in the current
/// working directory for server mode operation.
pub fn init_ws_server_logging() -> Option<WorkerGuard> {
    init_logging(Some(Path::new(".")))
}

/// Initializes logging for Tauri desktop app mode.
///
/// This is a convenience function that uses a platform-appropriate
/// log directory for desktop application operation.
#[cfg(target_os = "macos")]
pub fn init_desktop_logging() -> Option<WorkerGuard> {
    let log_dir = dirs::home_dir()
        .map(|p| p.join("Library").join("Logs").join("parallel-cli-runner"));
    init_logging(log_dir.as_deref())
}

/// Initializes logging for Tauri desktop app mode.
///
/// This is a convenience function that uses a platform-appropriate
/// log directory for desktop application operation.
#[cfg(target_os = "windows")]
pub fn init_desktop_logging() -> Option<WorkerGuard> {
    let log_dir = dirs::home_dir()
        .map(|p| p.join("parallel-cli-runner").join("logs"));
    init_logging(log_dir.as_deref())
}

/// Initializes logging for Tauri desktop app mode.
///
/// This is a convenience function that uses a platform-appropriate
/// log directory for desktop application operation.
#[cfg(target_os = "linux")]
pub fn init_desktop_logging() -> Option<WorkerGuard> {
    let log_dir = dirs::home_dir()
        .map(|p| p.join(".parallel-cli-runner").join("logs"));
    init_logging(log_dir.as_deref())
}

/// Initializes logging for Tauri desktop app mode.
///
/// This is a convenience function that uses a platform-appropriate
/// log directory for desktop application operation.
#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
pub fn init_desktop_logging() -> Option<WorkerGuard> {
    // Fallback to current directory for unknown platforms
    init_logging(None)
}

/// Initializes logging for VSCode extension mode.
///
/// Reads the log directory from the PARALLEL_CLI_RUNNER_LOG_DIR environment variable.
/// If not set, falls back to logging in the current directory.
pub fn init_extension_logging() -> Option<WorkerGuard> {
    let log_dir = std::env::var("PARALLEL_CLI_RUNNER_LOG_DIR")
        .ok()
        .map(PathBuf::from);

    init_logging(log_dir.as_deref())
}

/// Sets up a panic hook to capture panics to the log file.
///
/// This function installs a custom panic handler that logs panic information
/// using tracing::error! before executing the original panic handler.
/// This ensures panics are captured in log files for debugging.
pub fn setup_panic_hook() {
    std::panic::set_hook(Box::new(|panic_info| {
        let location = panic_info.location().unwrap_or_else(|| std::panic::Location::caller());
        let msg = match panic_info.payload().downcast_ref::<&str>() {
            Some(s) => *s,
            None => match panic_info.payload().downcast_ref::<String>() {
                Some(s) => &s[..],
                None => "Box<Any>",
            },
        };
        tracing::error!(
            msg = msg,
            file = location.file(),
            line = location.line(),
            column = location.column(),
            "PANIC"
        );
    }));
}
