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

fn unique_worktree_name(suffix: &str) -> String {
    format!("test-worktree-{}-{}", std::process::id(), suffix)
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
fn create_worktree_from_existing_branch() {
    // Create main repo with initial commit on master
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "# Master\n");
    commit_all(temp.path(), "Initial commit");

    // Create a branch called "feature-x"
    git::create_branch(temp.path(), "feature-x", None).expect("create branch");

    // Verify the branch exists
    let branches = git::list_branches(temp.path()).expect("list branches");
    assert!(branches.iter().any(|b| b.name == "feature-x"));

    // Create a worktree from the existing branch "feature-x"
    // The worktree path should be relative to the repo root
    let worktree_path = temp.path().join(format!("../{}", unique_worktree_name("feature-x")));
    fs::create_dir_all(worktree_path.parent().unwrap()).expect("create worktree parent dir");

    git::add_worktree(
        temp.path(),
        &worktree_path,
        "feature-x", // Use existing branch name as the branch for worktree
        "feature-x", // Start point is the existing branch
    )
    .expect("add worktree from existing branch");

    // Verify the worktree was created
    assert!(worktree_path.exists(), "worktree directory should exist");
    assert!(
        worktree_path.join(".git").exists(),
        "worktree should have .git file"
    );
    assert!(
        worktree_path.join("README.md").exists(),
        "worktree should have files from the branch"
    );

    // Verify the worktree appears in list_worktrees
    let worktrees = git::list_worktrees(temp.path()).expect("list worktrees");
    let worktree_path_canonical = git::canonicalize_path(&worktree_path)
        .to_string_lossy()
        .to_string();
    assert!(
        worktrees.iter().any(|w| w.path == worktree_path_canonical),
        "worktree should appear in list_worktrees"
    );
    assert!(
        worktrees.iter().any(|w| w.branch == "feature-x"),
        "worktree should be on feature-x branch"
    );

    // Verify we can make commits in the worktree
    write_file(&worktree_path, "feature.txt", "Feature X content\n");
    git::commit(&worktree_path, "Feature X commit", true, false).expect("commit in worktree");

    // The worktree should be ahead of master
    let worktrees = git::list_worktrees(temp.path()).expect("list worktrees");
    let feature_worktree = worktrees
        .iter()
        .find(|w| w.branch == "feature-x")
        .expect("find feature-x worktree");
    assert_eq!(feature_worktree.ahead, 1, "worktree should be ahead by 1 commit");
}

#[test]
fn create_worktree_from_branch_with_relative_path() {
    // Test that relative paths work correctly
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "# Master\n");
    commit_all(temp.path(), "Initial commit");

    // Create a branch
    git::create_branch(temp.path(), "feature-y", None).expect("create branch");

    // Create worktree using relative path
    let unique_name = unique_worktree_name("feature-y");
    let worktree_relative = std::path::PathBuf::from(format!("../{}", unique_name));
    git::add_worktree(
        temp.path(),
        &worktree_relative,
        "feature-y",
        "feature-y",
    )
    .expect("add worktree with relative path");

    // The worktree should be created at the relative path
    let expected_path = temp
        .path()
        .parent()
        .unwrap()
        .join(&unique_name)
        .canonicalize()
        .unwrap();
    assert!(expected_path.exists(), "worktree should exist at relative path");

    // Verify it appears in list_worktrees
    let worktrees = git::list_worktrees(temp.path()).expect("list worktrees");
    let expected_path_str = expected_path.to_string_lossy().to_string();
    assert!(
        worktrees.iter().any(|w| w.path == expected_path_str),
        "worktree should be found via list_worktrees"
    );
}

#[test]
fn create_worktree_from_non_existent_branch_fails() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "# Master\n");
    commit_all(temp.path(), "Initial commit");

    // Try to create worktree from a branch that doesn't exist
    let worktree_path = temp.path().join(format!("../{}", unique_worktree_name("nonexistent")));

    let result = git::add_worktree(
        temp.path(),
        &worktree_path,
        "nonexistent-branch",
        "nonexistent-branch",
    );

    assert!(result.is_err(), "should fail when branch doesn't exist");
    assert!(!worktree_path.exists(), "worktree directory should not be created");
}

#[test]
fn create_worktree_from_existing_branch_at_head() {
    // Test creating a worktree from an existing branch at its current (head) state
    // This is the typical use case: create a worktree for an existing branch
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "# Master\n");
    commit_all(temp.path(), "Initial commit");

    write_file(temp.path(), "file.txt", "v1\n");
    commit_all(temp.path(), "Commit 1");

    write_file(temp.path(), "file.txt", "v2\n");
    commit_all(temp.path(), "Commit 2");

    git::create_branch(temp.path(), "feature-z", None).expect("create branch");

    // Create worktree from the existing branch at its current state
    let worktree_path = temp.path().join(format!("../{}", unique_worktree_name("feature-z")));
    fs::create_dir_all(worktree_path.parent().unwrap()).expect("create worktree parent dir");

    // When creating from an existing branch, the branch name is both the target
    // branch and the start point (meaning use the branch's current state)
    git::add_worktree(
        temp.path(),
        &worktree_path,
        "feature-z", // branch name (also the start_point when using existing branch)
        "feature-z", // start_point = existing branch name
    )
    .expect("add worktree from existing branch");

    // Verify the worktree was created and has the correct content (the branch's current state)
    let content = fs::read_to_string(worktree_path.join("file.txt")).expect("read file");
    assert_eq!(
        content, "v2\n",
        "worktree should have content from the branch's current state (HEAD)"
    );

    // Verify the worktree is on feature-z branch
    let worktrees = git::list_worktrees(temp.path()).expect("list worktrees");
    assert!(
        worktrees.iter().any(|w| w.branch == "feature-z"),
        "worktree should be on feature-z branch"
    );
}
