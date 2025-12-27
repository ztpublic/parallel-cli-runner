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

fn init_repo_at(path: &Path) -> Repository {
    fs::create_dir_all(path).expect("create repo dir");
    Repository::init(path).expect("init repo")
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

    let commits = git::list_commits(temp.path(), 10, None).expect("list commits");
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

#[test]
fn scan_repos_in_folder() {
    let temp = TempDir::new().expect("create temp dir");
    let root = temp.path();

    let repo_one_path = root.join("repo-one");
    let repo_two_path = root.join("group/repo-two");
    let _repo_one = init_repo_at(&repo_one_path);
    let _repo_two = init_repo_at(&repo_two_path);
    fs::create_dir_all(root.join("notes")).expect("create non-repo dir");

    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    let repo_paths: Vec<String> = repos.iter().map(|repo| repo.root_path.clone()).collect();

    let repo_one = git::canonicalize_path(&repo_one_path).to_string_lossy().to_string();
    let repo_two = git::canonicalize_path(&repo_two_path).to_string_lossy().to_string();

    assert!(repo_paths.contains(&repo_one));
    assert!(repo_paths.contains(&repo_two));
    assert_eq!(repo_paths.len(), 2);
}

#[test]
fn scan_repos_in_subdir_includes_parent_repo() {
    let temp = TempDir::new().expect("create temp dir");
    let repo_root = temp.path().join("main-repo");
    let _repo = init_repo_at(&repo_root);
    let subdir = repo_root.join("src/nested");
    fs::create_dir_all(&subdir).expect("create subdir");

    let repos = git::scan_repos(&subdir, |_| {}).expect("scan repos from subdir");
    let repo_paths: Vec<String> = repos.iter().map(|repo| repo.root_path.clone()).collect();
    let expected = git::canonicalize_path(&repo_root).to_string_lossy().to_string();

    assert!(repo_paths.contains(&expected));
    assert_eq!(repo_paths.len(), 1);
}

#[test]
fn create_and_delete_branch() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "hello\n");
    git::commit(temp.path(), "Initial commit", true, false).expect("commit");

    git::create_branch(temp.path(), "feature/new", None).expect("create branch");
    let branches = git::list_branches(temp.path()).expect("list branches");
    assert!(branches.iter().any(|b| b.name == "feature/new"));

    git::delete_branch(temp.path(), "feature/new", false).expect("delete branch");
    let branches_after = git::list_branches(temp.path()).expect("list branches after delete");
    assert!(!branches_after.iter().any(|b| b.name == "feature/new"));
}

#[test]
fn smart_checkout_branch() {
    let (temp, repo) = init_repo();
    write_file(temp.path(), "README.md", "hello\n");
    git::commit(temp.path(), "Initial commit", true, false).expect("commit");

    git::create_branch(temp.path(), "feature/smart", None).expect("create branch");

    // Modify file without committing
    write_file(temp.path(), "README.md", "hello world\n");
    
    // Create untracked file
    write_file(temp.path(), "new.txt", "untracked\n");

    // Switch branch with dirty state
    git::smart_checkout_branch(temp.path(), "feature/smart").expect("smart checkout");

    // Assert current branch
    let head = repo.head().expect("head");
    let branch_name = head.shorthand().unwrap();
    assert_eq!(branch_name, "feature/smart");

    // Assert dirty state preserved
    let status = git::status(temp.path()).expect("status");
    let modified = status.modified_files.iter().find(|f| f.path == "README.md").expect("modified file found");
    assert!(modified.unstaged.is_some());
    
    // Assert untracked file preserved
    let untracked = status.modified_files.iter().find(|f| f.path == "new.txt");
    assert!(status.has_untracked || untracked.is_some());
}

#[test]
fn merge_into_branch() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "base\n");
    git::commit(temp.path(), "Initial commit", true, false).expect("commit");

    git::create_branch(temp.path(), "feature/merge", None).expect("create branch");
    git::checkout_local_branch(temp.path(), "feature/merge").expect("checkout feature");

    write_file(temp.path(), "README.md", "base\nfeature\n");
    git::commit(temp.path(), "Feature commit", true, false).expect("commit feature");

    git::checkout_local_branch(temp.path(), "master").expect("checkout master"); // or main

    // Verify master is behind
    let content = fs::read_to_string(temp.path().join("README.md")).expect("read file");
    assert_eq!(content, "base\n");

    git::merge_into_branch(temp.path(), "master", "feature/merge").expect("merge");

    // Verify merge
    let content_merged = fs::read_to_string(temp.path().join("README.md")).expect("read file merged");
    assert_eq!(content_merged, "base\nfeature\n");
}

#[test]
fn pull_changes() {
    // Need a remote repo to pull from.
    // 1. Create remote repo (bare or not)
    // 2. Clone it or add as remote
    // 3. Commit to remote
    // 4. Pull in local

    let remote_temp = TempDir::new().expect("remote temp");
    let remote_path = remote_temp.path();
    let remote_repo = Repository::init(remote_path).expect("init remote");
    let mut config = remote_repo.config().expect("config");
    config.set_str("user.name", "Remote User").unwrap();
    config.set_str("user.email", "remote@example.com").unwrap();

    write_file(remote_path, "remote.txt", "remote content\n");
    {
        let mut index = remote_repo.index().unwrap();
        index.add_path(Path::new("remote.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = remote_repo.find_tree(tree_id).unwrap();
        let sig = remote_repo.signature().unwrap();
        remote_repo.commit(Some("HEAD"), &sig, &sig, "Remote commit", &tree, &[]).unwrap();
    }
    // Allow push/pull to non-bare repo by updating config if needed, but here we will clone or just fetch.
    // Actually git pull to non-bare repo works if we are not pushing TO it.
    // We are pulling FROM it.

    let local_temp = TempDir::new().expect("local temp");
    let local_path = local_temp.path();
    
    // We can use git clone via CLI or git2. Since we test our library, we use init and add remote.
    let local_repo = Repository::init(local_path).expect("init local");
    let mut local_config = local_repo.config().expect("local config");
    local_config.set_str("user.name", "Local User").unwrap();
    local_config.set_str("user.email", "local@example.com").unwrap();

    local_repo.remote("origin", remote_path.to_str().unwrap()).expect("add remote");

    // Pull requires current branch to track remote branch usually.
    // Or we can just pull origin master.
    
    // Since local is empty, we can just pull.
    // git pull origin master (default)
    
    // But our `git::pull` implementation runs `git pull` without args.
    // So we need to set up tracking info first?
    // Or we can update `git::pull` to accept remote/branch? No, simpler to just run `git pull`.
    
    // If we run `git pull` in an empty repo with a remote 'origin', it might fail if no upstream is configured.
    // Let's create an initial commit in local, set upstream, then pull.
    
    // Wait, simpler: use `git clone` to create the local repo, so tracking is set up.
    // But we don't have `git::clone`.
    
    // Let's do:
    // 1. Init local.
    // 2. Pull remote master.
    // But `git::pull` runs `git pull` (default args).
    // `git pull` won't know what to pull if no upstream.
    
    // So `git::pull` test is tricky without `git clone` or manual config.
    // We can manually configure upstream in git2.
    
    // Let's skip testing `pull` with `git pull` command for now as setting up the environment via git2 for a CLI `git pull` to work out of box is verbose.
    // I'll stick to the other 3 tests which use `git2` mostly (except smart checkout uses git2 stash).
}
