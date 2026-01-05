//! Builder for creating test git repositories with a fluent API.
//!
//! # Example
//!
//! ```rust
//! use parallel_cli_runner_lib::git;
//! use crate::common::GitRepoBuilder;
//!
//! let repo = GitRepoBuilder::new()
//!     .with_file("README.md", "hello")
//!     .commit("Initial commit")
//!     .with_branch("feature", true)
//!     .with_file("feature.txt", "new feature")
//!     .commit("Add feature")
//!     .build();
//!
//! // Use the repo
//! let branches = git::list_branches(repo.path()).unwrap();
//! assert!(branches.iter().any(|b| b.name == "feature"));
//! ```

use git2::{build::CheckoutBuilder, Repository};
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

/// Test repository with metadata
pub struct TestRepo {
    temp: TempDir,
    pub repo: Repository,
}

impl TestRepo {
    /// Get the path to the repository
    pub fn path(&self) -> &Path {
        self.temp.path()
    }

    /// Get the canonical path to the repository
    pub fn canonical_path(&self) -> PathBuf {
        std::fs::canonicalize(self.temp.path()).unwrap_or_else(|_| self.temp.path().to_path_buf())
    }

    /// Get the current HEAD commit OID
    pub fn head_oid(&self) -> String {
        self.repo
            .head()
            .expect("head")
            .target()
            .expect("head target")
            .to_string()
    }

    /// Get the current branch name
    pub fn current_branch(&self) -> String {
        self.repo
            .head()
            .expect("head")
            .shorthand()
            .expect("branch name")
            .to_string()
    }

    /// Get all branches
    pub fn branches(&self) -> Vec<String> {
        self.repo
            .branches(Some(git2::BranchType::Local))
            .expect("branches")
            .filter_map(|b| b.ok())
            .filter_map(|(b, _)| b.name().ok().flatten().map(|s| s.to_string()))
            .collect()
    }
}

/// Builder for creating test git repositories
pub struct GitRepoBuilder {
    initial_branch: Option<String>,
    with_initial_commit: bool,
    initial_commit_message: Option<String>,
    operations: Vec<Operation>,
}

enum Operation {
    WriteFile { path: String, content: String },
    Commit { message: String },
    CreateBranch { name: String, checkout: bool },
    Checkout { branch: String },
    CreateWorktree { path: String, branch: String },
}

impl Default for GitRepoBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl GitRepoBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            initial_branch: Some("main".to_string()),
            with_initial_commit: false,
            initial_commit_message: None,
            operations: Vec::new(),
        }
    }

    /// Set the initial branch name (defaults to "main")
    pub fn with_initial_branch(mut self, name: impl Into<String>) -> Self {
        self.initial_branch = Some(name.into());
        self
    }

    /// Create an initial commit after repo initialization
    pub fn with_initial_commit(mut self, message: impl Into<String>) -> Self {
        self.with_initial_commit = true;
        self.initial_commit_message = Some(message.into());
        self
    }

    /// Write a file to the repository
    pub fn with_file(mut self, path: impl Into<String>, content: impl Into<String>) -> Self {
        self.operations.push(Operation::WriteFile {
            path: path.into(),
            content: content.into(),
        });
        self
    }

    /// Stage all changes and commit
    pub fn commit(mut self, message: impl Into<String>) -> Self {
        self.operations.push(Operation::Commit {
            message: message.into(),
        });
        self
    }

    /// Create a new branch
    pub fn with_branch(mut self, name: impl Into<String>, checkout: bool) -> Self {
        self.operations.push(Operation::CreateBranch {
            name: name.into(),
            checkout,
        });
        self
    }

    /// Checkout an existing branch
    pub fn checkout(mut self, branch: impl Into<String>) -> Self {
        self.operations.push(Operation::Checkout {
            branch: branch.into(),
        });
        self
    }

    /// Create a worktree
    pub fn with_worktree(mut self, path: impl Into<String>, branch: impl Into<String>) -> Self {
        self.operations.push(Operation::CreateWorktree {
            path: path.into(),
            branch: branch.into(),
        });
        self
    }

    /// Build the test repository
    pub fn build(self) -> TestRepo {
        let temp = TempDir::new().expect("create temp dir");
        let repo = Repository::init(temp.path()).expect("init repo");

        // Configure git user
        let mut config = repo.config().expect("repo config");
        config
            .set_str("user.name", "Test User")
            .expect("set user name");
        config
            .set_str("user.email", "test@example.com")
            .expect("set user email");

        let initial_branch = self.initial_branch.clone().unwrap_or_else(|| "main".to_string());

        // Create initial commit if requested (empty repo can't rename branches)
        // Or if we have operations that need commits (we need at least one commit to do branch operations)
        let needs_initial_commit = self.with_initial_commit || !self.operations.is_empty();

        if needs_initial_commit {
            let message = self
                .initial_commit_message
                .unwrap_or_else(|| "Initial commit".to_string());

            // Set HEAD to the desired branch name first (this creates the branch on first commit)
            let _ = repo.set_head(&format!("refs/heads/{}", initial_branch));

            // Create an empty initial commit (allow empty)
            Self::do_commit_allow_empty(&repo, &message);
        }

        // Execute operations
        for op in self.operations {
            match op {
                Operation::WriteFile { path, content } => {
                    Self::write_file(temp.path(), &path, &content);
                }
                Operation::Commit { message } => {
                    Self::do_commit(&repo, &message, &[]);
                }
                Operation::CreateBranch { name, checkout } => {
                    let head = repo.head().expect("head");
                    let obj = head.peel_to_commit().expect("peel to commit");
                    repo.branch(&name, &obj, false).expect("create branch");
                    if checkout {
                        repo.set_head(&format!("refs/heads/{}", name)).expect("set head");
                        let mut checkout_opts = CheckoutBuilder::new();
                        checkout_opts.force();
                        repo.checkout_head(Some(&mut checkout_opts)).expect("checkout head");
                    }
                }
                Operation::Checkout { branch } => {
                    repo.set_head(&format!("refs/heads/{}", branch)).expect("set head");
                    let mut checkout_opts = CheckoutBuilder::new();
                    checkout_opts.force();
                    repo.checkout_head(Some(&mut checkout_opts)).expect("checkout head");
                }
                Operation::CreateWorktree { path, branch } => {
                    let worktree_path = temp.path().join(&path);
                    fs::create_dir_all(worktree_path.parent().unwrap())
                        .expect("create worktree parent dir");
                    // Use the library function for worktree creation
                    // Note: This requires at least one commit to exist
                    parallel_cli_runner_lib::git::add_worktree(temp.path(), &worktree_path, &branch, "HEAD")
                        .expect("create worktree");
                }
            }
        }

        TestRepo { temp, repo }
    }

    fn write_file(root: &Path, relative: &str, contents: &str) -> PathBuf {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create file parent");
        }
        fs::write(&path, contents).expect("write file");
        path
    }

    fn do_commit(repo: &Repository, message: &str, paths: &[&str]) {
        let mut index = repo.index().expect("index");

        // Stage specified paths or all changes
        if paths.is_empty() {
            index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)
                .expect("add all");
        } else {
            for path in paths {
                index.add_path(Path::new(path)).expect("add path");
            }
        }

        index.write().expect("write index");

        let tree_id = index.write_tree().expect("write tree");
        let tree = repo.find_tree(tree_id).expect("find tree");

        let sig = repo.signature().expect("signature");

        // Get parent commit if HEAD exists
        let parent: Option<git2::Commit> = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_commit().ok());

        if let Some(p) = &parent {
            repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[p])
                .expect("commit");
        } else {
            repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[])
                .expect("commit");
        }
    }

    fn do_commit_allow_empty(repo: &Repository, message: &str) {
        let sig = repo.signature().expect("signature");

        // Get parent commit if HEAD exists
        let parent: Option<git2::Commit> = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_commit().ok());

        // Use empty tree for empty commit
        let tree_id = repo
            .treebuilder(None)
            .and_then(|mut tb| tb.write())
            .expect("create empty tree");
        let tree = repo.find_tree(tree_id).expect("find tree");

        if let Some(p) = &parent {
            repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[p])
                .expect("commit");
        } else {
            repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[])
                .expect("commit");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builder_basic() {
        let repo = GitRepoBuilder::new()
            .with_file("README.md", "hello")
            .commit("Initial commit")
            .build();

        assert!(repo.path().join("README.md").exists());
        assert_eq!(repo.current_branch(), "main");
        assert_eq!(repo.branches().len(), 1);
    }

    #[test]
    fn test_builder_with_branches() {
        let repo = GitRepoBuilder::new()
            .with_file("file.txt", "v1")
            .commit("Commit 1")
            .with_branch("feature", true)
            .with_file("feature.txt", "new")
            .commit("Feature commit")
            .build();

        assert_eq!(repo.current_branch(), "feature");
        assert!(repo.branches().contains(&"feature".to_string()));
        assert!(repo.branches().contains(&"main".to_string()));
    }

    #[test]
    fn test_builder_initial_commit() {
        let repo = GitRepoBuilder::new()
            .with_initial_commit("Start")
            .build();

        // Verify HEAD exists and points to a commit
        let head = repo.repo.head().expect("HEAD should exist");
        assert!(head.is_branch(), "HEAD should be a branch");

        // Check that HEAD points to a commit
        let target = head.target().expect("HEAD should point to a commit");
        let commit = repo.repo.find_commit(target).expect("commit should exist");

        // Verify the commit message matches
        let commit_msg = commit.message().unwrap();
        assert!(commit_msg.contains("Start"), "commit message should match");
    }
}
