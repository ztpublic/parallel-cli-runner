// Git module - organized by functionality
//
// This module has been split into focused submodules for better maintainability:
// - types: All DTOs and type definitions
// - error: Error types and utilities
// - proxy: System proxy configuration
// - scanner: Repository scanning and detection
// - status: Git status operations
// - branches: Branch listing and management
// - remotes: Remote operations (pull, push)
// - worktrees: Worktree management
// - stashes: Stash operations
// - tags: Tag operations
// - diff: Diff generation
// - operations: High-level operations (commit, merge, rebase, reset, revert, squash)

mod types;
mod error;
mod proxy;
mod scanner;
mod status;
mod branches;
mod remotes;
mod worktrees;
mod stashes;
mod tags;
mod diff;
mod operations;

// Re-export all public types
pub use types::*;

// Re-export error types
pub use error::{GitError, is_missing_ref_error};

// Re-export scanner functions
pub use scanner::{detect_repo, scan_repos, canonicalize_path};

// Re-export status functions
pub use status::{
    status, diff, diff_stats_worktree, diff_stats_against_branch,
    stage_paths, unstage_paths, discard_paths, stage_all, unstage_all,
    list_submodules,
};

// Re-export branch functions
pub use branches::{
    list_branches, list_remote_branches, default_branch, current_branch,
    branch_exists, create_branch, delete_branch, checkout_local_branch,
    smart_checkout_branch,
};

// Re-export remote functions
pub use remotes::{list_remotes, pull, push};

// Re-export worktree functions
pub use worktrees::{list_worktrees, add_worktree, remove_worktree, detach_worktree_head};

// Re-export stash functions
pub use stashes::{list_stashes, apply_stash, drop_stash, stash_save};

// Re-export tag functions
pub use tags::{list_tags};

// Re-export diff functions
pub use diff::{get_unified_diff};

// Re-export operation functions
pub use operations::{
    list_commits, commit, merge_into_branch, rebase_branch, reset, revert,
    squash_commits, commits_in_remote,
};
