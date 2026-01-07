use uuid::Uuid;
use crate::command_error::CommandError;

pub mod git;
pub mod acp;

// Re-export all git commands
pub use git::*;

// Re-export all acp commands
pub use acp::*;

/// Shared helper function to parse UUID strings
pub fn parse_uuid(id: &str) -> Result<Uuid, CommandError> {
    Uuid::parse_str(id).map_err(|_| CommandError::new("invalid_argument", "invalid id"))
}
