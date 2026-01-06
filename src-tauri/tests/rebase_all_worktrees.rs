//! Integration test for "Rebase all on repo-active" bug fix
//!
//! This test replicates the bug where clicking "Rebase all on repo-active"
//! in the Worktrees tab would cause:
//! 1. HEAD.lock errors due to multiple rebases competing for the same repo
//! 2. Worktree names becoming "HEAD" instead of their branch names
//!
//! The root cause was that the frontend was passing the main repo's ID
//! instead of the worktree's path to the rebase function.

use parallel_cli_runner_lib::git;
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

fn init_repo() -> (TempDir, git2::Repository) {
    let temp = TempDir::new().expect("create temp dir");
    let repo = git2::Repository::init(temp.path()).expect("init repo");
    let mut config = repo.config().expect("repo config");
    config.set_str("user.name", "Test User").expect("set user name");
    config
        .set_str("user.email", "test@example.com")
        .expect("set user email");
    (temp, repo)
}

fn write_file(root: &Path, relative: &str, contents: &str) -> PathBuf {
    let path = root.join(relative);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("create file parent");
    }
    fs::write(&path, contents).expect("write file");
    path
}

fn commit_all(repo_root: &Path, message: &str) {
    git::commit(repo_root, message, true, false).expect("commit")
}

/// Test that demonstrates the bug: rebasing worktrees using the main repo path
/// causes failures because multiple branches are checked out in different worktrees.
#[test]
fn rebase_all_worktrees_using_main_repo_path_fails() {
    // Setup: Create main repo with initial commits
    let (temp, _repo) = init_repo();
    let main_repo_path = temp.path();

    write_file(main_repo_path, "README.md", "# Test Repo\n");
    commit_all(main_repo_path, "Initial commit");

    write_file(main_repo_path, "master.txt", "Master branch content\n");
    commit_all(main_repo_path, "Add master file");

    // Create two worktrees OUTSIDE the main repo to avoid interference
    let parent_dir = temp.path().parent().unwrap();
    let pid = std::process::id();
    let worktree_a_path = parent_dir.join(format!("rebase-fail-a-{}", pid));
    let worktree_b_path = parent_dir.join(format!("rebase-fail-b-{}", pid));

    git::add_worktree(main_repo_path, &worktree_a_path, "feature-a", "HEAD")
        .expect("add worktree a");
    git::add_worktree(main_repo_path, &worktree_b_path, "feature-b", "HEAD")
        .expect("add worktree b");

    // Add commits to each worktree
    write_file(&worktree_a_path, "feature-a.txt", "Feature A\n");
    git::commit(&worktree_a_path, "Add feature A", true, false).expect("commit");

    write_file(&worktree_b_path, "feature-b.txt", "Feature B\n");
    git::commit(&worktree_b_path, "Add feature B", true, false).expect("commit");

    // Add a commit to master branch (switching back to master first)
    git::checkout_local_branch(main_repo_path, "master").expect("checkout master");
    write_file(main_repo_path, "update.txt", "Master update\n");
    commit_all(main_repo_path, "Master branch update");

    // Verify both worktrees are now behind master
    let worktrees = git::list_worktrees(main_repo_path).expect("list worktrees");
    let worktree_a = worktrees.iter().find(|w| w.branch == "feature-a").unwrap();
    let worktree_b = worktrees.iter().find(|w| w.branch == "feature-b").unwrap();

    assert_eq!(worktree_a.behind, 1, "feature-a should be behind by 1");
    assert_eq!(worktree_b.behind, 1, "feature-b should be behind by 1");

    // BUG SCENARIO: Try to rebase both worktrees using the main repo path
    // This is what the buggy frontend code was doing
    //
    // The first rebase might work, but the second will likely fail with:
    // - "failed to lock file .git/HEAD.lock for writing"
    // - or "branch is checked out elsewhere" error

    let result_a = git::rebase_branch(main_repo_path, "feature-a", "master");
    let result_b = git::rebase_branch(main_repo_path, "feature-b", "master");

    // At least one should fail because branches are checked out in worktrees
    // This demonstrates the bug
    let first_failed = result_a.is_err();
    let second_failed = result_b.is_err();

    assert!(
        first_failed || second_failed,
        "At least one rebase should fail when using main repo path for worktree branches. \
        This is the bug: you cannot rebase a branch that is checked out in a worktree \
        unless you perform the operation in the worktree's context."
    );

    // Print the error messages for debugging
    if let Err(e) = result_a {
        eprintln!("Rebase feature-a failed: {}", e);
    }
    if let Err(e) = result_b {
        eprintln!("Rebase feature-b failed: {}", e);
    }
}

/// Test that demonstrates the fix: rebasing worktrees using their own paths
/// succeeds without HEAD.lock errors.
#[test]
fn rebase_all_worktrees_using_worktree_paths_succeeds() {
    // Setup: Create main repo with initial commits
    let (temp, _repo) = init_repo();
    let main_repo_path = temp.path();

    write_file(main_repo_path, "README.md", "# Test Repo\n");
    commit_all(main_repo_path, "Initial commit");

    write_file(main_repo_path, "master.txt", "Master branch content\n");
    commit_all(main_repo_path, "Add master file");

    // Create two worktrees OUTSIDE the main repo to avoid interference
    let parent_dir = temp.path().parent().unwrap();
    let pid = std::process::id();
    let worktree_a_path = parent_dir.join(format!("rebase-succeed-a-{}", pid));
    let worktree_b_path = parent_dir.join(format!("rebase-succeed-b-{}", pid));

    git::add_worktree(main_repo_path, &worktree_a_path, "feature-a", "HEAD")
        .expect("add worktree a");
    git::add_worktree(main_repo_path, &worktree_b_path, "feature-b", "HEAD")
        .expect("add worktree b");

    // Add commits to each worktree
    write_file(&worktree_a_path, "feature-a.txt", "Feature A\n");
    git::commit(&worktree_a_path, "Add feature A", true, false).expect("commit");

    write_file(&worktree_b_path, "feature-b.txt", "Feature B\n");
    git::commit(&worktree_b_path, "Add feature B", true, false).expect("commit");

    // Add a commit to master branch (switching back to master first)
    git::checkout_local_branch(main_repo_path, "master").expect("checkout master");
    write_file(main_repo_path, "update.txt", "Master update\n");
    commit_all(main_repo_path, "Master branch update");

    // Verify both worktrees are now behind master
    let worktrees = git::list_worktrees(main_repo_path).expect("list worktrees");
    let worktree_a = worktrees.iter().find(|w| w.branch == "feature-a").unwrap();
    let worktree_b = worktrees.iter().find(|w| w.branch == "feature-b").unwrap();

    assert_eq!(worktree_a.behind, 1, "feature-a should be behind by 1");
    assert_eq!(worktree_b.behind, 1, "feature-b should be behind by 1");

    // FIX: Use the worktree paths instead of the main repo path
    // This is what the fixed frontend code does
    let result_a = git::rebase_branch(&worktree_a_path, "feature-a", "master");
    let result_b = git::rebase_branch(&worktree_b_path, "feature-b", "master");

    // Both should succeed
    assert!(
        result_a.is_ok(),
        "Rebase feature-a should succeed when using worktree path: {:?}",
        result_a
    );
    assert!(
        result_b.is_ok(),
        "Rebase feature-b should succeed when using worktree path: {:?}",
        result_b
    );

    // Verify the worktrees are no longer behind
    let worktrees_after = git::list_worktrees(main_repo_path).expect("list worktrees");
    let worktree_a_after = worktrees_after
        .iter()
        .find(|w| w.branch == "feature-a")
        .unwrap();
    let worktree_b_after = worktrees_after
        .iter()
        .find(|w| w.branch == "feature-b")
        .unwrap();

    assert_eq!(worktree_a_after.behind, 0, "feature-a should no longer be behind");
    assert_eq!(worktree_b_after.behind, 0, "feature-b should no longer be behind");

    // Verify worktree names didn't become "HEAD"
    assert_ne!(
        worktree_a_after.branch, "HEAD",
        "Worktree branch name should not become HEAD"
    );
    assert_ne!(
        worktree_b_after.branch, "HEAD",
        "Worktree branch name should not become HEAD"
    );
}

/// Test that simulates the exact "Rebase all on active" workflow
/// with the fix applied.
#[test]
fn rebase_all_on_active_workflow() {
    // Setup: Create main repo with initial commits
    let (temp, _repo) = init_repo();
    let main_repo_path = temp.path();

    write_file(main_repo_path, "README.md", "# Test Repo\n");
    commit_all(main_repo_path, "Initial commit");

    write_file(main_repo_path, "master.txt", "Master branch content\n");
    commit_all(main_repo_path, "Add master file");

    // Create three worktrees OUTSIDE the main repo to simulate a real scenario
    let parent_dir = temp.path().parent().unwrap();
    let pid = std::process::id();
    let worktree_paths = vec![
        parent_dir.join(format!("rebase-workflow-a-{}", pid)),
        parent_dir.join(format!("rebase-workflow-b-{}", pid)),
        parent_dir.join(format!("rebase-workflow-c-{}", pid)),
    ];

    let branches = vec!["feature-a", "feature-b", "feature-c"];

    for (worktree_path, branch) in worktree_paths.iter().zip(branches.iter()) {
        git::add_worktree(main_repo_path, worktree_path, branch, "HEAD")
            .expect("add worktree");
        write_file(worktree_path, &format!("{}.txt", branch), branch);
        git::commit(worktree_path, &format!("Add {}", branch), true, false)
            .expect("commit");
    }

    // Add commits to master branch to make worktrees fall behind
    git::checkout_local_branch(main_repo_path, "master").expect("checkout master");
    write_file(main_repo_path, "update1.txt", "Update 1\n");
    commit_all(main_repo_path, "Master update 1");

    write_file(main_repo_path, "update2.txt", "Update 2\n");
    commit_all(main_repo_path, "Master update 2");

    // Verify all worktrees are behind
    let worktrees = git::list_worktrees(main_repo_path).expect("list worktrees");
    for branch in &branches {
        let worktree = worktrees.iter().find(|w| w.branch == *branch).unwrap();
        assert_eq!(worktree.behind, 2, "{} should be behind by 2", branch);
    }

    // Simulate "Rebase all on active" workflow using worktree paths (the fix)
    for (worktree_path, branch) in worktree_paths.iter().zip(branches.iter()) {
        let result = git::rebase_branch(worktree_path, branch, "master");
        assert!(
            result.is_ok(),
            "Rebase {} should succeed when using worktree path: {:?}",
            branch,
            result
        );
    }

    // Verify all worktrees are now up to date
    let worktrees_after = git::list_worktrees(main_repo_path).expect("list worktrees");
    for branch in &branches {
        let worktree = worktrees_after.iter().find(|w| w.branch == *branch).unwrap();
        assert_eq!(worktree.behind, 0, "{} should no longer be behind", branch);
        assert_ne!(worktree.branch, "HEAD", "Worktree name should not become HEAD");
    }
}
