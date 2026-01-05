//! Integration tests for the Stashes tab functionality in the git manager panel.
//!
//! These tests cover the core stash-related operations used by the Stashes tab:
//! - Listing stashes
//! - Saving stashes with custom messages
//! - Saving stashes with/without untracked files
//! - Applying stashes
//! - Dropping stashes
//! - Handling invalid stash indices

mod common;

use parallel_cli_runner_lib::git;
use std::fs;

/// Tests listing stashes returns empty list when no stashes exist.
#[test]
fn stashes_tab_list_empty() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "content\n")
        .commit("Initial commit")
        .build();

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 0, "should return empty list when no stashes");
}

/// Tests saving a basic stash with a custom message.
#[test]
fn stashes_tab_save_with_message() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "original\n")
        .commit("Initial commit")
        .build();

    // Make changes
    fs::write(repo.path().join("file.txt"), "modified\n").expect("write file");

    // Save stash with message
    git::stash_save(repo.path(), Some("WIP: feature work".to_string()), false)
        .expect("stash save");

    // Verify stash was created
    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 1, "should have 1 stash");
    assert!(stashes[0].message.contains("WIP: feature work"),
            "stash should have custom message");
    assert_eq!(stashes[0].index, 0, "stash index should be 0");
}

/// Tests saving a stash without a message (default message).
#[test]
fn stashes_tab_save_without_message() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "original\n")
        .commit("Initial commit")
        .build();

    // Make changes
    fs::write(repo.path().join("file.txt"), "modified\n").expect("write file");

    // Save stash without message
    git::stash_save(repo.path(), None, false)
        .expect("stash save");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 1, "should have 1 stash");
    // When no message is provided, git creates a default message
    // Just verify the stash was created (message format varies by git version)
    assert!(!stashes[0].message.is_empty() || stashes[0].id.len() > 0,
            "stash should exist with either message or ID");
}

/// Tests saving a stash with untracked files.
#[test]
fn stashes_tab_save_with_untracked() {
    let repo = common::GitRepoBuilder::new()
        .with_file("tracked.txt", "tracked\n")
        .commit("Initial commit")
        .build();

    // Make tracked file changes and create untracked file
    fs::write(repo.path().join("tracked.txt"), "modified\n").expect("write tracked");
    fs::write(repo.path().join("untracked.txt"), "untracked\n").expect("write untracked");

    // Save stash including untracked files
    git::stash_save(repo.path(), Some("With untracked".to_string()), true)
        .expect("stash save with untracked");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 1, "should have 1 stash");

    // Both files should be gone from worktree
    assert!(!repo.path().join("untracked.txt").exists(),
            "untracked file should be stashed");
    let content = fs::read_to_string(repo.path().join("tracked.txt")).unwrap();
    assert_eq!(content, "tracked\n", "tracked file should be restored to HEAD state");
}

/// Tests saving a stash without including untracked files.
#[test]
fn stashes_tab_save_without_untracked() {
    let repo = common::GitRepoBuilder::new()
        .with_file("tracked.txt", "tracked\n")
        .commit("Initial commit")
        .build();

    // Modify tracked file and create untracked file
    fs::write(repo.path().join("tracked.txt"), "modified\n").expect("write tracked");
    fs::write(repo.path().join("untracked.txt"), "untracked\n").expect("write untracked");

    // Save stash without including untracked
    git::stash_save(repo.path(), Some("Without untracked".to_string()), false)
        .expect("stash save without untracked");

    // Untracked file should still exist
    assert!(repo.path().join("untracked.txt").exists(),
            "untracked file should not be stashed");

    // Tracked file should be restored
    let content = fs::read_to_string(repo.path().join("tracked.txt")).unwrap();
    assert_eq!(content, "tracked\n", "tracked file should be restored");
}

/// Tests applying a stash restores changes.
#[test]
fn stashes_tab_apply_restores_changes() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "original\n")
        .commit("Initial commit")
        .build();

    // Make changes
    fs::write(repo.path().join("file.txt"), "modified\n").expect("write file");

    // Save stash
    git::stash_save(repo.path(), Some("Work in progress".to_string()), false)
        .expect("stash save");

    // Verify file is back to original
    let content = fs::read_to_string(repo.path().join("file.txt")).unwrap();
    assert_eq!(content, "original\n", "file should be restored after stash");

    // Apply stash
    git::apply_stash(repo.path(), 0).expect("apply stash");

    // File should have modified content again
    let content = fs::read_to_string(repo.path().join("file.txt")).unwrap();
    assert_eq!(content, "modified\n", "file should have stashed content after apply");
}

/// Tests applying a stash preserves the stash entry.
#[test]
fn stashes_tab_apply_preserves_stash() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "original\n")
        .commit("Initial commit")
        .build();

    fs::write(repo.path().join("file.txt"), "modified\n").expect("write file");

    git::stash_save(repo.path(), Some("My stash".to_string()), false)
        .expect("stash save");

    git::apply_stash(repo.path(), 0).expect("apply stash");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 1, "stash should still exist after apply");
    assert_eq!(stashes[0].index, 0, "stash index should still be 0");
}

/// Tests dropping a stash removes it from the list.
#[test]
fn stashes_tab_drop_removes_stash() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "original\n")
        .commit("Initial commit")
        .build();

    fs::write(repo.path().join("file.txt"), "modified\n").expect("write file");

    git::stash_save(repo.path(), Some("Temporary stash".to_string()), false)
        .expect("stash save");

    assert_eq!(git::list_stashes(repo.path()).expect("list stashes").len(), 1,
               "should have 1 stash before drop");

    git::drop_stash(repo.path(), 0).expect("drop stash");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 0, "should have no stashes after drop");
}

/// Tests dropping multiple stashes in order.
#[test]
fn stashes_tab_drop_multiple() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "base\n")
        .commit("Initial commit")
        .build();

    // Create first stash
    fs::write(repo.path().join("file.txt"), "stash1\n").expect("write stash1");
    git::stash_save(repo.path(), Some("Stash 1".to_string()), false)
        .expect("stash save 1");

    // Create second stash
    fs::write(repo.path().join("file.txt"), "stash2\n").expect("write stash2");
    git::stash_save(repo.path(), Some("Stash 2".to_string()), false)
        .expect("stash save 2");

    // Create third stash
    fs::write(repo.path().join("file.txt"), "stash3\n").expect("write stash3");
    git::stash_save(repo.path(), Some("Stash 3".to_string()), false)
        .expect("stash save 3");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 3, "should have 3 stashes");

    // Drop the middle stash (index 1)
    git::drop_stash(repo.path(), 1).expect("drop stash 1");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 2, "should have 2 stashes after drop");
    assert!(stashes[0].message.contains("Stash 3"), "stash 3 should still be at index 0");
    assert!(stashes[1].message.contains("Stash 1"), "stash 1 should be at index 1");
}

/// Tests listing stashes returns proper metadata.
#[test]
fn stashes_tab_list_metadata() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "content\n")
        .commit("Initial commit")
        .build();

    fs::write(repo.path().join("file.txt"), "modified\n").expect("write file");

    git::stash_save(repo.path(), Some("Test stash message".to_string()), false)
        .expect("stash save");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");

    assert!(!stashes[0].id.is_empty(), "stash should have an ID");
    assert!(stashes[0].message.contains("Test stash message"),
            "stash should have custom message");
    assert!(!stashes[0].relative_time.is_empty(),
            "stash should have relative time");
    assert!(stashes[0].relative_time.contains("ago"),
            "relative time should contain 'ago'");
}

/// Tests applying stash with invalid index returns an error.
#[test]
fn stashes_tab_apply_invalid_index() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "content\n")
        .commit("Initial commit")
        .build();

    let result = git::apply_stash(repo.path(), 999);
    assert!(result.is_err(), "should error for invalid stash index");
}

/// Tests applying stash with negative index returns an error.
#[test]
fn stashes_tab_apply_negative_index() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "content\n")
        .commit("Initial commit")
        .build();

    let result = git::apply_stash(repo.path(), -1);
    assert!(result.is_err(), "should error for negative stash index");

    let err = result.unwrap_err();
    let err_msg = format!("{err}");
    assert!(err_msg.contains(">= 0"), "error should mention index must be >= 0");
}

/// Tests dropping stash with invalid index returns an error.
#[test]
fn stashes_tab_drop_invalid_index() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "content\n")
        .commit("Initial commit")
        .build();

    let result = git::drop_stash(repo.path(), 999);
    assert!(result.is_err(), "should error for invalid stash index");
}

/// Tests dropping stash with negative index returns an error.
#[test]
fn stashes_tab_drop_negative_index() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "content\n")
        .commit("Initial commit")
        .build();

    let result = git::drop_stash(repo.path(), -1);
    assert!(result.is_err(), "should error for negative stash index");

    let err = result.unwrap_err();
    let err_msg = format!("{err}");
    assert!(err_msg.contains(">= 0"), "error should mention index must be >= 0");
}

/// Tests saving multiple stashes preserves order.
#[test]
fn stashes_tab_multiple_stashes_order() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "base\n")
        .commit("Initial commit")
        .build();

    // Create stashes in order
    fs::write(repo.path().join("file.txt"), "first\n").expect("write first");
    git::stash_save(repo.path(), Some("First stash".to_string()), false)
        .expect("stash first");

    fs::write(repo.path().join("file.txt"), "second\n").expect("write second");
    git::stash_save(repo.path(), Some("Second stash".to_string()), false)
        .expect("stash second");

    fs::write(repo.path().join("file.txt"), "third\n").expect("write third");
    git::stash_save(repo.path(), Some("Third stash".to_string()), false)
        .expect("stash third");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 3, "should have 3 stashes");

    // Most recent stash should be at index 0
    assert!(stashes[0].message.contains("Third stash"), "index 0 should be most recent");
    assert_eq!(stashes[0].index, 0, "first stash should have index 0");

    assert!(stashes[1].message.contains("Second stash"), "index 1 should be second");
    assert_eq!(stashes[1].index, 1, "second stash should have index 1");

    assert!(stashes[2].message.contains("First stash"), "index 2 should be oldest");
    assert_eq!(stashes[2].index, 2, "third stash should have index 2");
}

/// Tests stash handles deleted files correctly.
#[test]
fn stashes_tab_save_deleted_files() {
    let repo = common::GitRepoBuilder::new()
        .with_file("to_delete.txt", "will be deleted\n")
        .commit("Initial commit")
        .build();

    // Delete the file and also make another change
    fs::remove_file(repo.path().join("to_delete.txt")).expect("remove file");
    fs::write(repo.path().join("other.txt"), "new file\n").expect("write new file");

    // Save stash
    git::stash_save(repo.path(), Some("Deleted file".to_string()), true)
        .expect("stash save");

    // After stash save, worktree should be clean (matching HEAD)
    // The deleted file should be restored from HEAD, new file should be stashed
    assert!(repo.path().join("to_delete.txt").exists(),
            "deleted file should be restored after stash save");
    assert!(!repo.path().join("other.txt").exists(),
            "new file should be stashed");

    // Apply stash to restore the new file and delete again
    git::apply_stash(repo.path(), 0).expect("apply stash");

    // After apply: file should be deleted again, new file restored
    assert!(!repo.path().join("to_delete.txt").exists(),
            "deleted file should be deleted again after apply");
    assert!(repo.path().join("other.txt").exists(),
            "new file should be restored after apply");
}

/// Tests stash with multiple file changes.
#[test]
fn stashes_tab_multiple_file_changes() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file1.txt", "original1\n")
        .with_file("file2.txt", "original2\n")
        .with_file("file3.txt", "original3\n")
        .commit("Initial commit")
        .build();

    // Modify multiple files
    fs::write(repo.path().join("file1.txt"), "modified1\n").expect("write file1");
    fs::write(repo.path().join("file2.txt"), "modified2\n").expect("write file2");
    fs::write(repo.path().join("file3.txt"), "modified3\n").expect("write file3");

    git::stash_save(repo.path(), Some("Multiple files".to_string()), false)
        .expect("stash save");

    // Verify all files restored to original
    let c1 = fs::read_to_string(repo.path().join("file1.txt")).unwrap();
    let c2 = fs::read_to_string(repo.path().join("file2.txt")).unwrap();
    let c3 = fs::read_to_string(repo.path().join("file3.txt")).unwrap();
    assert_eq!(c1, "original1\n");
    assert_eq!(c2, "original2\n");
    assert_eq!(c3, "original3\n");

    // Apply stash and verify all restored
    git::apply_stash(repo.path(), 0).expect("apply stash");

    let c1 = fs::read_to_string(repo.path().join("file1.txt")).unwrap();
    let c2 = fs::read_to_string(repo.path().join("file2.txt")).unwrap();
    let c3 = fs::read_to_string(repo.path().join("file3.txt")).unwrap();
    assert_eq!(c1, "modified1\n");
    assert_eq!(c2, "modified2\n");
    assert_eq!(c3, "modified3\n");
}

/// Tests stash with staged and unstaged changes.
#[test]
fn stashes_tab_staged_and_unstaged() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "original\n")
        .commit("Initial commit")
        .build();

    // Stage a change
    fs::write(repo.path().join("file.txt"), "staged\n").expect("write staged");
    git::stage_paths(repo.path(), &["file.txt".to_string()]).expect("stage");

    // Make another unstaged change
    fs::write(repo.path().join("file.txt"), "unstaged\n").expect("write unstaged");

    git::stash_save(repo.path(), Some("Staged and unstaged".to_string()), false)
        .expect("stash save");

    // File should be back to original
    let content = fs::read_to_string(repo.path().join("file.txt")).unwrap();
    assert_eq!(content, "original\n", "file should be restored");

    // Apply stash
    git::apply_stash(repo.path(), 0).expect("apply stash");

    // Should have the unstaged version after apply
    let content = fs::read_to_string(repo.path().join("file.txt")).unwrap();
    assert_eq!(content, "unstaged\n", "file should have unstaged content");
}

/// Tests stash handles new files correctly.
#[test]
fn stashes_tab_new_files() {
    let repo = common::GitRepoBuilder::new()
        .with_file("existing.txt", "existing\n")
        .commit("Initial commit")
        .build();

    // Create a new file
    fs::write(repo.path().join("newfile.txt"), "new content\n").expect("write new file");

    git::stash_save(repo.path(), Some("New file".to_string()), true)
        .expect("stash save with untracked");

    // New file should be gone
    assert!(!repo.path().join("newfile.txt").exists(),
            "new file should be stashed");

    // Apply stash
    git::apply_stash(repo.path(), 0).expect("apply stash");

    // New file should be restored
    assert!(repo.path().join("newfile.txt").exists(),
            "new file should be restored");
    let content = fs::read_to_string(repo.path().join("newfile.txt")).unwrap();
    assert_eq!(content, "new content\n", "new file content should match");
}

/// Tests stash without any changes is effectively a no-op.
#[test]
fn stashes_tab_save_with_no_changes() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "content\n")
        .commit("Initial commit")
        .build();

    // Try to save stash without any changes
    let _result = git::stash_save(repo.path(), Some("No changes".to_string()), false);

    // Git may not create a stash if there are no changes
    // The function might succeed but not create a stash entry
    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 0, "should not create stash with no changes");
}

/// Tests complete workflow: save, list, apply, drop.
#[test]
fn stashes_tab_complete_workflow() {
    let repo = common::GitRepoBuilder::new()
        .with_file("file.txt", "base\n")
        .commit("Initial commit")
        .build();

    // 1. Make changes and save stash
    fs::write(repo.path().join("file.txt"), "work in progress\n").expect("write file");

    git::stash_save(repo.path(), Some("Feature work".to_string()), false)
        .expect("stash save");

    // 2. List stashes
    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 1);
    assert!(stashes[0].message.contains("Feature work"));

    // 3. Verify worktree is clean
    let content = fs::read_to_string(repo.path().join("file.txt")).unwrap();
    assert_eq!(content, "base\n", "worktree should be clean");

    // 4. Apply stash
    git::apply_stash(repo.path(), 0).expect("apply stash");

    let content = fs::read_to_string(repo.path().join("file.txt")).unwrap();
    assert_eq!(content, "work in progress\n", "work should be restored");

    // 5. Clean up and drop stash
    git::reset(repo.path(), "HEAD", "hard").expect("reset");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 1, "stash should still exist");

    git::drop_stash(repo.path(), 0).expect("drop stash");

    let stashes = git::list_stashes(repo.path()).expect("list stashes");
    assert_eq!(stashes.len(), 0, "stash should be gone");
}
