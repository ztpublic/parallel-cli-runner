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

fn commit_all(repo_root: &Path, message: &str) {
    git::commit(repo_root, message, true, false).expect("commit")
}

fn head_oid(repo: &Repository) -> String {
    repo.head()
        .expect("head")
        .target()
        .expect("head target")
        .to_string()
}

#[test]
fn list_submodules_test() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "README.md", "main repo\n");
    commit_all(temp.path(), "Initial commit");

    let sub_temp = TempDir::new().expect("sub temp");
    let sub_repo = Repository::init(sub_temp.path()).expect("init sub");
    let mut config = sub_repo.config().expect("sub config");
    config.set_str("user.name", "Test User").unwrap();
    config.set_str("user.email", "test@example.com").unwrap();
    write_file(sub_temp.path(), "lib.rs", "pub fn hello() {}\n");
    {
        let mut index = sub_repo.index().unwrap();
        index.add_path(Path::new("lib.rs")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = sub_repo.find_tree(tree_id).unwrap();
        let sig = sub_repo.signature().unwrap();
        sub_repo.commit(Some("HEAD"), &sig, &sig, "Submodule commit", &tree, &[]).unwrap();
    }

    let url = sub_temp.path().to_str().unwrap();
    
    // Use git CLI to add submodule as it handles .gitmodules and cloning reliably
    let output = std::process::Command::new("git")
        .args(&["-c", "protocol.file.allow=always", "submodule", "add", url, "libs/mylib"])
        .current_dir(temp.path())
        .output()
        .expect("git submodule add");
        
    if !output.status.success() {
        panic!("git submodule add failed: {}", String::from_utf8_lossy(&output.stderr));
    }
    
    // Commit is done automatically by 'git submodule add' usually? No, it stages it.
    // We need to commit.
    commit_all(temp.path(), "Add submodule");

    let modules = git::list_submodules(temp.path()).expect("list submodules");
    assert_eq!(modules.len(), 1);
    assert_eq!(modules[0].name, "libs/mylib");
    // Path check might vary depending on canonicalization, but should contain libs/mylib
    assert!(modules[0].path.ends_with("libs/mylib"));
}

#[test]
fn stash_operations() {
    let (temp, _repo) = init_repo();
    write_file(temp.path(), "file.txt", "v1\n");
    commit_all(temp.path(), "Commit 1");

    write_file(temp.path(), "file.txt", "v2\n");
    
    let mut repo = Repository::open(temp.path()).unwrap();
    let sig = repo.signature().unwrap();
    repo.stash_save(&sig, "My stash", Some(git2::StashFlags::DEFAULT)).expect("stash save");
    
    // Test List
    let stashes = git::list_stashes(temp.path()).expect("list stashes");
    assert_eq!(stashes.len(), 1);
    assert!(stashes[0].message.contains("My stash"));
    
    // Test Apply
    // Hard reset to clear changes
    git::reset(temp.path(), "HEAD", "hard").expect("reset hard");
    let content = fs::read_to_string(temp.path().join("file.txt")).unwrap();
    assert_eq!(content, "v1\n");
    
    git::apply_stash(temp.path(), 0).expect("apply stash");
    let content = fs::read_to_string(temp.path().join("file.txt")).unwrap();
    assert_eq!(content, "v2\n");
    
    // Test Drop
    git::drop_stash(temp.path(), 0).expect("drop stash");
    let stashes = git::list_stashes(temp.path()).expect("list stashes");
    assert_eq!(stashes.len(), 0);
}

#[test]
fn commits_in_remote_test() {
    let (remote_temp, _remote_repo) = init_repo();
    write_file(remote_temp.path(), "file.txt", "base\n");
    commit_all(remote_temp.path(), "Base");
    
    let (local_temp, local_repo) = init_repo();
    local_repo.remote("origin", remote_temp.path().to_str().unwrap()).unwrap();
    
    let mut remote = local_repo.find_remote("origin").unwrap();
    remote.fetch(&["master"], None, None).unwrap();
    
    let remote_head = local_repo.find_reference("refs/remotes/origin/master").unwrap().target().unwrap();
    
    let exists = git::commits_in_remote(local_temp.path(), &[remote_head.to_string()]).expect("check");
    assert!(exists);
    
    write_file(local_temp.path(), "local.txt", "local\n");
    commit_all(local_temp.path(), "Local");
    let local_head = head_oid(&local_repo);
    
    let exists = git::commits_in_remote(local_temp.path(), &[local_head]).expect("check local");
    assert!(!exists);
}

#[test]
fn push_test() {
    let remote_temp = TempDir::new().expect("remote temp");
    let remote_repo = Repository::init_bare(remote_temp.path()).expect("init bare");
    
    let (local_temp, local_repo) = init_repo();
    local_repo.remote("origin", remote_temp.path().to_str().unwrap()).unwrap();
    
    // Configure push.autoSetupRemote to allow pushing without explicit upstream set beforehand
    let mut config = local_repo.config().unwrap();
    config.set_str("push.autoSetupRemote", "true").unwrap();
    
    write_file(local_temp.path(), "file.txt", "v1\n");
    commit_all(local_temp.path(), "Commit 1");
    
    // Push should succeed
    git::push(local_temp.path(), false).expect("push");
    
    let head = remote_repo.head().unwrap().target().unwrap();
    let local_head = local_repo.head().unwrap().target().unwrap();
    assert_eq!(head, local_head);
}
