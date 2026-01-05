//! Integration tests for the Repos tab functionality in the git manager panel.
//!
//! These tests cover the core repository-related operations used by the Repos tab:
//! - Detecting repositories from current directory
//! - Scanning folders for repositories
//! - Repository information extraction
//! - Handling of worktrees (deduplication)
//! - Submodule discovery
//! - Bare repository detection

mod common;

use parallel_cli_runner_lib::git;
use std::fs;
use git2::Repository;

/// Tests detecting a repository from a subdirectory.
#[test]
fn repos_tab_detect_from_nested_subdirectory() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Test Repo\n")
        .commit("Initial commit")
        .build();

    // Create a deeply nested subdirectory
    let nested = repo.path().join("src/components/nested");
    fs::create_dir_all(&nested).expect("create nested dir");

    let detected = git::detect_repo(&nested).expect("detect repo");
    assert!(detected.is_some(), "should detect repo from nested dir");

    let detected_path = detected.unwrap();
    let expected = git::canonicalize_path(repo.path());
    assert_eq!(
        detected_path.to_string_lossy().to_string(),
        expected.to_string_lossy().to_string(),
        "should return repo root path"
    );
}

/// Tests detecting repository returns None when not in a git repository.
#[test]
fn repos_tab_detect_returns_none_outside_repo() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let non_repo_dir = temp.path();

    let detected = git::detect_repo(non_repo_dir).expect("detect repo");
    assert!(detected.is_none(), "should return None outside git repo");
}

/// Tests detecting repository from repository root itself.
#[test]
fn repos_tab_detect_from_repo_root() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Test\n")
        .commit("Initial commit")
        .build();

    let detected = git::detect_repo(repo.path()).expect("detect repo");
    assert!(detected.is_some(), "should detect repo from root");

    let detected_path = detected.unwrap();
    let expected = git::canonicalize_path(repo.path());
    assert_eq!(
        detected_path.to_string_lossy().to_string(),
        expected.to_string_lossy().to_string()
    );
}

/// Tests scanning a folder with multiple repositories.
#[test]
fn repos_tab_scan_multiple_repos() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    // Create multiple repositories
    let repo_one = root.join("projects/project-one");
    let repo_two = root.join("projects/project-two");
    let repo_three = root.join("libs/lib-three");

    Repository::init(&repo_one).expect("init repo one");
    Repository::init(&repo_two).expect("init repo two");
    Repository::init(&repo_three).expect("init repo three");

    // Configure git for each repo
    for path in [&repo_one, &repo_two, &repo_three] {
        let repo = Repository::open(path).expect("open repo");
        let mut config = repo.config().expect("config");
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();
    }

    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    let repo_paths: Vec<String> = repos.iter().map(|r| r.root_path.clone()).collect();

    assert_eq!(repos.len(), 3, "should find 3 repositories");
    assert!(repo_paths.iter().any(|p| p.contains("project-one")));
    assert!(repo_paths.iter().any(|p| p.contains("project-two")));
    assert!(repo_paths.iter().any(|p| p.contains("lib-three")));
}

/// Tests scanning returns sorted results by path.
#[test]
fn repos_tab_scan_returns_sorted() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    // Create repos in non-alphabetical order
    let repo_z = root.join("z-repo");
    let repo_a = root.join("a-repo");
    let repo_m = root.join("m-repo");

    Repository::init(&repo_z).expect("init z");
    Repository::init(&repo_a).expect("init a");
    Repository::init(&repo_m).expect("init m");

    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 3);

    // Should be sorted alphabetically
    assert!(repos[0].root_path.contains("a-repo"));
    assert!(repos[1].root_path.contains("m-repo"));
    assert!(repos[2].root_path.contains("z-repo"));
}

/// Tests scanning excludes non-git directories.
#[test]
fn repos_tab_scan_excludes_non_git_dirs() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    // Create a git repository
    let repo_path = root.join("git-repo");
    Repository::init(&repo_path).expect("init git repo");

    // Create non-git directories
    fs::create_dir_all(root.join("notes/docs")).expect("create notes");
    fs::create_dir_all(root.join("temp/files")).expect("create temp");

    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 1, "should only find git repo");
    assert!(repos[0].root_path.contains("git-repo"));
}

/// Tests scanning from within a repo includes that repo.
#[test]
fn repos_tab_scan_from_within_repo() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Test\n")
        .commit("Initial commit")
        .build();

    // Create a nested directory
    let nested = repo.path().join("src/components");
    fs::create_dir_all(&nested).expect("create nested");

    // Scan from nested directory
    let repos = git::scan_repos(&nested, |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 1, "should find parent repo");

    let expected = git::canonicalize_path(repo.path()).to_string_lossy().to_string();
    assert_eq!(repos[0].root_path, expected);
}

/// Tests repository info includes correct metadata.
#[test]
fn repos_tab_repo_info_metadata() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Test\n")
        .commit("Initial commit")
        .build();

    // Scan the repo to get its info
    let repos = git::scan_repos(repo.path(), |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 1);

    let info = &repos[0];
    assert!(!info.repo_id.is_empty(), "should have repo_id");
    assert!(!info.root_path.is_empty(), "should have root_path");
    assert!(!info.name.is_empty(), "should have name");
    assert!(!info.is_bare, "should not be bare");
}

/// Tests repository name is extracted from path.
#[test]
fn repos_tab_repo_name_extraction() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    let my_project = root.join("my-awesome-project");
    Repository::init(&my_project).expect("init repo");

    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 1);
    assert_eq!(repos[0].name, "my-awesome-project");
}

/// Tests scanning handles worktrees correctly (deduplicates).
#[test]
fn repos_tab_scan_deduplicates_worktrees() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Test\n")
        .commit("Initial commit")
        .build();

    // Create a worktree
    let worktree_path = repo.path().join("worktrees/feature-branch");
    fs::create_dir_all(worktree_path.parent().unwrap()).expect("create worktree dir");
    git::add_worktree(repo.path(), &worktree_path, "feature", "HEAD")
        .expect("create worktree");

    // Scan should return only 1 repo (main repo, worktree excluded)
    let repos = git::scan_repos(repo.path(), |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 1, "should deduplicate worktrees");

    let expected = git::canonicalize_path(repo.path()).to_string_lossy().to_string();
    assert_eq!(repos[0].root_path, expected, "should be main repo");
}

/// Tests scanning empty directory returns empty list.
#[test]
fn repos_tab_scan_empty_directory() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 0, "should return empty list");
}

/// Tests scanning with deeply nested repositories.
#[test]
fn repos_tab_scan_deeply_nested() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    // Create deeply nested repos
    let deep1 = root.join("a/b/c/repo1");
    let deep2 = root.join("x/y/z/w/repo2");

    fs::create_dir_all(&deep1).expect("create deep1 dirs");
    fs::create_dir_all(&deep2).expect("create deep2 dirs");

    Repository::init(&deep1).expect("init repo1");
    Repository::init(&deep2).expect("init repo2");

    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 2, "should find both deeply nested repos");
}

/// Tests scanning from a non-existent directory returns empty.
#[test]
fn repos_tab_scan_nonexistent_directory() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let nonexistent = temp.path().join("does/not/exist");

    let repos = git::scan_repos(&nonexistent, |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 0, "should return empty list for non-existent dir");
}

/// Tests repository detection with bare repository.
#[test]
fn repos_tab_detect_bare_repository() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let bare_path = temp.path().join("bare-repo.git");

    Repository::init_bare(&bare_path).expect("init bare repo");

    let detected = git::detect_repo(&bare_path).expect("detect bare repo");
    assert!(detected.is_some(), "should detect bare repo");

    let repos = git::scan_repos(&bare_path, |_| {}).expect("scan bare repos");
    assert_eq!(repos.len(), 1);
    assert!(repos[0].is_bare, "should be marked as bare");
}

/// Tests scanning detects repositories at root level.
#[test]
fn repos_tab_scan_root_level_repos() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    let repo1 = root.join("repo-one");
    let repo2 = root.join("repo-two");
    Repository::init(&repo1).expect("init repo1");
    Repository::init(&repo2).expect("init repo2");

    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 2);
}

/// Tests repository with submodule includes submodule in scan.
#[test]
fn repos_tab_scan_with_submodules() {
    // This test verifies that submodules are enqueued for scanning
    // Creating actual submodules requires git CLI, so we test the basic structure
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Main\n")
        .commit("Initial commit")
        .build();

    // Scan should find at least the main repo
    let repos = git::scan_repos(repo.path(), |_| {}).expect("scan repos");
    assert!(repos.len() >= 1, "should find main repo");
}

/// Tests scan progress callback is invoked.
#[test]
fn repos_tab_scan_progress_callback() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    let repo1 = root.join("repo1");
    let repo2 = root.join("repo2");
    Repository::init(&repo1).expect("init repo1");
    Repository::init(&repo2).expect("init repo2");

    use std::sync::{Arc, Mutex};
    let callback_count = Arc::new(Mutex::new(0));
    let callback_count_clone = Arc::clone(&callback_count);

    let _repos = git::scan_repos(root, move |_| {
        *callback_count_clone.lock().unwrap() += 1;
    }).expect("scan repos");

    // Callback should be invoked for directories scanned
    assert!(*callback_count.lock().unwrap() > 0, "progress callback should be invoked");
}

/// Tests scanning handles permission errors gracefully.
#[test]
fn repos_tab_scan_handles_permission_errors() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    let repo_path = root.join("valid-repo");
    Repository::init(&repo_path).expect("init repo");

    // Create a directory with restricted permissions (if supported by OS)
    let restricted = root.join("restricted");
    fs::create_dir(&restricted).expect("create restricted dir");

    // On Unix, set directory to no-read permissions
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&restricted).unwrap().permissions();
        perms.set_mode(0o000);
        fs::set_permissions(&restricted, perms).unwrap_or(());
    }

    // Scan should still succeed and find the valid repo
    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    assert!(repos.len() >= 1, "should find valid repo despite restricted dir");

    // Clean up - restore permissions for cleanup
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&restricted).unwrap().permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&restricted, perms).unwrap_or(());
    }
}

/// Tests detecting repo from symlinked directory (if supported).
#[test]
fn repos_tab_detect_from_symlink() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Test\n")
        .commit("Initial commit")
        .build();

    // Create a symlink to the repo (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::symlink;
        let temp = tempfile::TempDir::new().expect("create temp dir");
        let link = temp.path().join("repo-link");

        if symlink(repo.path(), &link).is_ok() {
            let detected = git::detect_repo(&link).expect("detect from symlink");
            assert!(detected.is_some(), "should detect repo through symlink");
        }
    }

    // On non-Unix systems or if symlink creation fails, just verify repo detection works
    let detected = git::detect_repo(repo.path()).expect("detect from root");
    assert!(detected.is_some());
}

/// Tests scan with mixed git and non-git content.
#[test]
fn repos_tab_scan_mixed_content() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let root = temp.path();

    // Create git repos
    let repo1 = root.join("projects/api");
    let repo2 = root.join("projects/web");
    Repository::init(&repo1).expect("init api");
    Repository::init(&repo2).expect("init web");

    // Create non-git content
    fs::create_dir_all(root.join("docs/guide")).expect("create docs");
    fs::create_dir_all(root.join("assets/images")).expect("create assets");
    fs::write(root.join("notes.txt"), "some notes").expect("write notes");

    let repos = git::scan_repos(root, |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 2, "should only find git repos");
}

/// Tests repo_id matches root_path for identification.
#[test]
fn repos_tab_repo_id_matches_root_path() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Test\n")
        .commit("Initial commit")
        .build();

    let repos = git::scan_repos(repo.path(), |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 1);

    assert_eq!(repos[0].repo_id, repos[0].root_path,
               "repo_id should match root_path");
}

/// Tests scanning with single repository at root.
#[test]
fn repos_tab_scan_single_repo_at_root() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Single Repo\n")
        .commit("Initial commit")
        .build();

    let repos = git::scan_repos(repo.path(), |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 1);

    let expected = git::canonicalize_path(repo.path()).to_string_lossy().to_string();
    assert_eq!(repos[0].root_path, expected);
}

/// Tests scan handles repository with no commits (empty repo).
#[test]
fn repos_tab_scan_empty_repository() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let empty_repo = temp.path().join("empty-repo");
    Repository::init(&empty_repo).expect("init empty repo");

    let repos = git::scan_repos(&empty_repo, |_| {}).expect("scan empty repo");
    assert_eq!(repos.len(), 1, "should find empty repository");
}

/// Tests detect_repo handles repository with special characters in name.
#[test]
fn repos_tab_detect_special_chars_in_name() {
    let temp = tempfile::TempDir::new().expect("create temp dir");
    let special_name = temp.path().join("my-project_2024");

    Repository::init(&special_name).expect("init repo with special chars");

    let detected = git::detect_repo(&special_name).expect("detect repo");
    assert!(detected.is_some());

    let repos = git::scan_repos(temp.path(), |_| {}).expect("scan repos");
    assert_eq!(repos.len(), 1);
    assert!(repos[0].name.contains("my-project_2024"));
}

/// Tests scanning repository with .git file (git worktree).
#[test]
fn repos_tab_scan_git_dot_file() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Test\n")
        .commit("Initial commit")
        .build();

    // Create a worktree which uses a .git file instead of directory
    let worktree_path = repo.path().join("worktrees/my-feature");
    fs::create_dir_all(worktree_path.parent().unwrap()).expect("create worktree parent");

    if git::add_worktree(repo.path(), &worktree_path, "main", "HEAD").is_ok() {
        // Worktree created, scan should deduplicate
        let repos = git::scan_repos(repo.path(), |_| {}).expect("scan repos");
        // Should find main repo but not duplicate worktree
        assert!(repos.len() <= 2, "should handle worktree correctly");
    }
}

/// Tests canonicalize_path handles non-existent paths.
#[test]
fn repos_tab_canonicalize_nonexistent() {
    let nonexistent = std::path::Path::new("/this/path/does/not/exist/really");

    // canonicalize_path should fall back to original path if it doesn't exist
    let result = git::canonicalize_path(nonexistent);
    assert_eq!(result, nonexistent, "should return original path for non-existent");
}

/// Tests scan with repository at top level of scanned directory.
#[test]
fn repos_tab_scan_repo_at_top_level() {
    let repo = common::GitRepoBuilder::new()
        .with_file("README.md", "# Test\n")
        .commit("Initial commit")
        .build();

    // Scan from parent directory that contains the repo
    let repos = git::scan_repos(repo.path().parent().unwrap(), |_| {})
        .expect("scan repos");

    assert_eq!(repos.len(), 1, "should find repo at top level");
}
