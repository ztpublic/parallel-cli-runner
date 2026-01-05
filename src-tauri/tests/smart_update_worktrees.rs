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

#[test]
fn smart_update_worktrees_simple_case() {
    // Create main repo with initial commit
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "# Master\n");
    commit_all(temp.path(), "Initial commit");

    // Create master.txt on master branch
    write_file(temp.path(), "master.txt", "Master content\n");
    commit_all(temp.path(), "Add master file");

    // Create feature-a worktree with 2 commits ahead of master
    let worktree_a_path = temp.path().join("worktree-a");
    git::add_worktree(temp.path(), &worktree_a_path, "feature-a", "master")
        .expect("add worktree a");

    write_file(&worktree_a_path, "feature-a-1.txt", "Feature A commit 1\n");
    git::commit(&worktree_a_path, "Feature A commit 1", true, false).expect("commit");

    write_file(&worktree_a_path, "feature-a-2.txt", "Feature A commit 2\n");
    git::commit(&worktree_a_path, "Feature A commit 2", true, false).expect("commit");

    // Create feature-b worktree with same content as master (no commits ahead)
    let worktree_b_path = temp.path().join("worktree-b");
    git::add_worktree(temp.path(), &worktree_b_path, "feature-b", "master")
        .expect("add worktree b");

    // Verify initial state
    let worktrees = git::list_worktrees(temp.path()).expect("list worktrees");
    assert!(worktrees.iter().any(|w| w.branch == "feature-a"));
    assert!(worktrees.iter().any(|w| w.branch == "feature-b"));

    // Check ahead/behind status
    let worktree_a = worktrees.iter().find(|w| w.branch == "feature-a").unwrap();
    let worktree_b = worktrees.iter().find(|w| w.branch == "feature-b").unwrap();

    assert_eq!(worktree_a.ahead, 2);
    assert_eq!(worktree_a.behind, 0);
    assert_eq!(worktree_b.ahead, 0);
    assert_eq!(worktree_b.behind, 0);

    // Simulate smart update by detaching HEAD first
    // This is what the fixed implementation does
    for worktree in &worktrees {
        if worktree.branch == "master" {
            continue;
        }

        // Detach the worktree HEAD
        git::detach_worktree_head(&std::path::PathBuf::from(&worktree.path))
            .expect("detach worktree head");

        // Now rebase should succeed
        let result = git::rebase_branch(temp.path(), &worktree.branch, "master");
        assert!(result.is_ok(), "rebase should succeed after detaching worktree head");

        // Checkout the branch back in the worktree
        git::checkout_local_branch(&std::path::PathBuf::from(&worktree.path), &worktree.branch)
            .expect("checkout branch back in worktree");
    }
}

#[test]
fn rebase_branch_checked_out_in_worktree_fails() {
    // This test demonstrates the bug: you can't rebase a branch
    // that's checked out in a worktree

    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "# Master\n");
    commit_all(temp.path(), "Initial commit");

    // Create a worktree
    let worktree_path = temp.path().join("worktree");
    git::add_worktree(temp.path(), &worktree_path, "feature", "master")
        .expect("add worktree");

    // Add a commit in the worktree
    write_file(&worktree_path, "feature.txt", "Feature\n");
    git::commit(&worktree_path, "Feature commit", true, false).expect("commit");

    // Add a commit on master
    write_file(temp.path(), "master.txt", "Master\n");
    commit_all(temp.path(), "Master commit");

    // Try to rebase feature onto master from the master repo
    // This should fail because feature is checked out in the worktree
    let result = git::rebase_branch(temp.path(), "feature", "master");

    assert!(result.is_err(), "rebase should fail when branch is checked out in worktree");

    let err = result.unwrap_err();
    let err_msg = format!("{}", err);
    // The error should mention that the branch is checked out
    assert!(err_msg.contains("checked out") || err_msg.contains("worktree") || err_msg.contains("elsewhere"),
        "Error should mention branch is checked out: {}", err_msg);
}

#[test]
fn smart_update_worktrees_preconditions() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "# Master\n");
    commit_all(temp.path(), "Initial commit");

    // Create a worktree OUTSIDE the main repo to avoid interference
    let parent_dir = temp.path().parent().unwrap();
    let worktree_name = format!("test-worktree-{}", std::process::id());
    let worktree_path = parent_dir.join(&worktree_name);

    git::add_worktree(temp.path(), &worktree_path, "feature", "master")
        .expect("add worktree");

    // Add commit to master (in the main repo, not the worktree)
    git::checkout_local_branch(temp.path(), "master").expect("checkout master");
    write_file(temp.path(), "master.txt", "Master\n");
    commit_all(temp.path(), "Master commit");

    // Now feature is behind master by 1 commit
    let worktrees = git::list_worktrees(temp.path()).expect("list worktrees");
    let feature_worktree = worktrees.iter().find(|w| w.branch == "feature").unwrap();

    assert_eq!(feature_worktree.behind, 1);
    assert_eq!(feature_worktree.ahead, 0);

    // Smart update should fail if any worktree is behind
    let worktrees = git::list_worktrees(temp.path()).expect("list worktrees");
    let behind_worktree = worktrees.iter().find(|w| w.behind > 0);

    assert!(behind_worktree.is_some(), "Should find a worktree that's behind");
    assert_eq!(behind_worktree.unwrap().branch, "feature");
}

#[test]
fn smart_update_worktrees_detached_head_fails() {
    // Create a worktree with detached HEAD (should fail smart update)
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "# Master\n");
    commit_all(temp.path(), "Initial commit");

    // Create a worktree and detach it
    let worktree_path = temp.path().join("worktree-detach");
    git::add_worktree(temp.path(), &worktree_path, "feature", "master")
        .expect("add worktree");

    // Detach HEAD in worktree
    git::detach_worktree_head(&worktree_path).expect("detach HEAD");

    // List worktrees should show detached HEAD
    let worktrees = git::list_worktrees(temp.path()).expect("list worktrees");
    let detached_worktree = worktrees.iter().find(|w| w.branch == "HEAD");

    assert!(detached_worktree.is_some(), "Should find a worktree with detached HEAD");
    assert_eq!(detached_worktree.unwrap().path, git::canonicalize_path(&worktree_path).to_string_lossy().to_string());
}
