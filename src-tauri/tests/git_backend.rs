use parallel_cli_runner_lib::git;
use git2::Repository;
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

fn init_repo() -> (TempDir, Repository) {
    let temp = TempDir::new().expect("create temp dir");
    let repo = Repository::init(temp.path()).expect("init repo");
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

#[test]
fn detect_repo_from_subdir() {
    let (temp, _repo) = init_repo();
    let nested = temp.path().join("nested/dir");
    fs::create_dir_all(&nested).expect("create nested dir");

    let detected = git::detect_repo(&nested).expect("detect repo");
    let expected = git::canonicalize_path(temp.path());
    assert_eq!(
        detected.map(|path| path.to_string_lossy().to_string()),
        Some(expected.to_string_lossy().to_string())
    );
}

#[test]
fn status_stage_unstage_files() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "src/main.rs", "fn main() {}\n");

    let status = git::status(temp.path()).expect("status");
    assert!(status.has_untracked, "expected untracked files");

    git::stage_paths(temp.path(), &["src/main.rs".to_string()]).expect("stage file");
    let status = git::status(temp.path()).expect("status after stage");
    assert!(status.has_staged, "expected staged changes");

    git::unstage_paths(temp.path(), &["src/main.rs".to_string()]).expect("unstage file");
    let status = git::status(temp.path()).expect("status after unstage");
    assert!(!status.has_staged, "expected no staged changes");
    assert!(status.has_untracked, "expected file to be untracked again");
}

#[test]
fn stage_all_and_unstage_all() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "file.txt", "hello\n");

    git::stage_all(temp.path()).expect("stage all");
    let status = git::status(temp.path()).expect("status after stage all");
    assert!(status.has_staged, "expected staged changes");

    git::unstage_all(temp.path()).expect("unstage all");
    let status = git::status(temp.path()).expect("status after unstage all");
    assert!(!status.has_staged, "expected no staged changes");
}

#[test]
fn commit_and_list_commits() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "hello\n");

    git::commit(temp.path(), "Initial commit", true, false).expect("commit");

    let commits = git::list_commits(temp.path(), 10).expect("list commits");
    assert_eq!(commits.len(), 1);
    assert_eq!(commits[0].summary, "Initial commit");
}

#[test]
fn list_branches_and_remote_branches() {
    let (temp, repo) = init_repo();
    write_file(temp.path(), "README.md", "hello\n");
    git::commit(temp.path(), "Initial commit", true, false).expect("commit");

    let branches = git::list_branches(temp.path()).expect("list branches");
    assert!(!branches.is_empty(), "expected local branches");
    assert!(branches.iter().any(|b| !b.last_commit.is_empty()));

    let head = repo.head().expect("head");
    let oid = head.target().expect("head oid");
    repo.reference(
        "refs/remotes/origin/feature/test",
        oid,
        true,
        "create remote branch",
    )
    .expect("create remote ref");

    let remote_branches = git::list_remote_branches(temp.path()).expect("list remote branches");
    assert!(remote_branches
        .iter()
        .any(|b| b.name == "origin/feature/test"));
}

#[test]
fn list_remotes() {
    let (temp, repo) = init_repo();
    repo.remote("origin", "https://example.com/repo.git")
        .expect("create remote");

    let remotes = git::list_remotes(temp.path()).expect("list remotes");
    assert_eq!(remotes.len(), 1);
    assert_eq!(remotes[0].name, "origin");
    assert_eq!(remotes[0].fetch, "https://example.com/repo.git");
    assert_eq!(remotes[0].push, "https://example.com/repo.git");
}

#[test]
fn list_worktrees() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "hello\n");
    git::commit(temp.path(), "Initial commit", true, false).expect("commit");

    let worktree_path = temp.path().join("worktrees/feature-one");
    fs::create_dir_all(worktree_path.parent().unwrap()).expect("create worktree dir");
    git::add_worktree(
        temp.path(),
        &worktree_path,
        "feature/one",
        "HEAD",
    )
    .expect("add worktree");

    let worktrees = git::list_worktrees(temp.path()).expect("list worktrees");
    let paths: Vec<String> = worktrees.iter().map(|w| w.path.clone()).collect();
    let repo_path = git::canonicalize_path(temp.path()).to_string_lossy().to_string();
    let worktree_path = git::canonicalize_path(&worktree_path).to_string_lossy().to_string();
    assert!(paths.iter().any(|p| p == &repo_path));
    assert!(paths.iter().any(|p| p == &worktree_path));
    assert!(worktrees.iter().any(|w| w.branch == "feature/one"));
}
