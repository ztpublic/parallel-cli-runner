use crate::git::branches::checkout_branch;
use crate::git::error::{GitError, is_missing_ref_error};
use crate::git::proxy::configure_proxy;
use crate::git::status::open_repo;
use crate::git::types::CommitInfoDto;
use git2::{build, ErrorCode, MergeOptions, Oid, RevertOptions, ResetType, Repository, Sort, StashFlags, BranchType};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::process::Command;

pub fn list_commits(
    cwd: &Path,
    limit: usize,
    skip: Option<usize>,
) -> Result<Vec<CommitInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let mut revwalk = match repo.revwalk() {
        Ok(walk) => walk,
        Err(err) if err.code() == ErrorCode::UnbornBranch => return Ok(Vec::new()),
        Err(err) => return Err(GitError::Git2(err)),
    };
    if let Err(err) = revwalk.push_head() {
        if err.code() == ErrorCode::UnbornBranch || is_missing_ref_error(&err) {
            return Ok(Vec::new());
        }
        return Err(GitError::Git2(err));
    }
    let mut commits = Vec::new();
    let skip = skip.unwrap_or(0);
    for oid in revwalk.skip(skip).take(limit) {
        let oid = match oid {
            Ok(oid) => oid,
            Err(err) if is_missing_ref_error(&err) => continue,
            Err(err) => return Err(GitError::Git2(err)),
        };
        let commit = match repo.find_commit(oid) {
            Ok(commit) => commit,
            Err(err) if is_missing_ref_error(&err) => continue,
            Err(err) => return Err(GitError::Git2(err)),
        };
        let summary = commit.summary().unwrap_or_default().to_string();
        let author = commit.author().name().unwrap_or_default().to_string();
        let relative_time = format_relative_time(commit.time());
        commits.push(CommitInfoDto {
            id: commit.id().to_string(),
            summary,
            author,
            relative_time,
        });
    }
    Ok(commits)
}

pub fn list_commits_range(
    cwd: &Path,
    include_branch: &str,
    exclude_branch: &str,
) -> Result<Vec<CommitInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let mut revwalk = repo.revwalk()?;

    let include_ref = repo.revparse_single(include_branch)?;
    let include_commit = include_ref.peel_to_commit()?;
    revwalk.push(include_commit.id())?;

    let exclude_ref = repo.revparse_single(exclude_branch)?;
    let exclude_commit = exclude_ref.peel_to_commit()?;
    revwalk.hide(exclude_commit.id())?;

    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME | Sort::REVERSE)?;

    let mut commits = Vec::new();
    for oid in revwalk {
        let oid = match oid {
            Ok(oid) => oid,
            Err(err) if is_missing_ref_error(&err) => continue,
            Err(err) => return Err(GitError::Git2(err)),
        };
        let commit = match repo.find_commit(oid) {
            Ok(commit) => commit,
            Err(err) if is_missing_ref_error(&err) => continue,
            Err(err) => return Err(GitError::Git2(err)),
        };
        let summary = commit.summary().unwrap_or_default().to_string();
        let author = commit.author().name().unwrap_or_default().to_string();
        let relative_time = format_relative_time(commit.time());
        commits.push(CommitInfoDto {
            id: commit.id().to_string(),
            summary,
            author,
            relative_time,
        });
    }
    Ok(commits)
}

pub fn commit(cwd: &Path, message: &str, stage_all: bool, amend: bool) -> Result<(), GitError> {
    let repo = open_repo(cwd)?;
    let mut index = repo.index()?;

    if stage_all {
        index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)?;
        index.write()?;
    }

    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let sig = repo.signature()?;

    if amend {
        let head = repo.head().map_err(|err| {
            if err.code() == ErrorCode::UnbornBranch {
                GitError::GitFailed {
                    code: None,
                    stderr: "cannot amend without any commits".to_string(),
                }
            } else {
                GitError::Git2(err)
            }
        })?;
        let head_id = head.target().ok_or_else(|| GitError::GitFailed {
            code: None,
            stderr: "cannot amend without a valid HEAD".to_string(),
        })?;
        let head_commit = repo.find_commit(head_id)?;
        let mut parents = Vec::new();
        for i in 0..head_commit.parent_count() {
            parents.push(head_commit.parent(i)?);
        }
        let parent_refs: Vec<&git2::Commit<'_>> = parents.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_refs)?;
        return Ok(());
    }

    let mut parents = Vec::new();
    if let Ok(head) = repo.head() {
        if let Some(head_id) = head.target() {
            let head_commit = repo.find_commit(head_id)?;
            if head_commit.tree_id() == tree.id() {
                return Err(GitError::GitFailed {
                    code: None,
                    stderr: "nothing to commit".to_string(),
                });
            }
            parents.push(head_commit);
        }
    }
    let parent_refs: Vec<&git2::Commit<'_>> = parents.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_refs)?;
    Ok(())
}

pub fn merge_into_branch(
    repo_root: &Path,
    target_branch: &str,
    source_branch: &str,
) -> Result<(), GitError> {
    let mut repo = open_repo(repo_root)?;
    if target_branch.trim().is_empty() || source_branch.trim().is_empty() {
        return Err(GitError::GitFailed {
            code: None,
            stderr: "targetBranch and sourceBranch are required".to_string(),
        });
    }

    let target_refname = {
        let target_ref = repo.find_branch(target_branch, BranchType::Local)?;
        target_ref
            .get()
            .name()
            .ok_or_else(|| GitError::GitFailed {
                code: None,
                stderr: "target branch refname is invalid".to_string(),
            })?
            .to_string()
    };
    let source_refname = {
        let source_ref = repo.find_branch(source_branch, BranchType::Local)?;
        source_ref
            .get()
            .name()
            .ok_or_else(|| GitError::GitFailed {
                code: None,
                stderr: "source branch refname is invalid".to_string(),
            })?
            .to_string()
    };

    let original_head = repo
        .head()
        .ok()
        .and_then(|head| head.name().map(|name| name.to_string()));
    let switched = original_head
        .as_deref()
        .map(|name| name != target_refname)
        .unwrap_or(true);

    let mut created_stash = false;
    if is_repo_dirty(&repo)? {
        let msg = "parallel-cli-runner: auto-stash before merge";
        let sig = repo.signature()?;
        repo.stash_save(&sig, msg, Some(StashFlags::INCLUDE_UNTRACKED))?;
        created_stash = true;
    }

    if switched {
        if let Err(err) = checkout_branch(&repo, &target_refname) {
            if created_stash {
                let _ = repo.stash_pop(0, None);
            }
            return Err(err);
        }
    }

    {
        let annotated = {
            let source_ref = repo.find_reference(&source_refname)?;
            repo.reference_to_annotated_commit(&source_ref)?
        };
        let annotated_id = annotated.id();
        let mut merge_opts = MergeOptions::new();
        let mut checkout_opts = build::CheckoutBuilder::new();
        checkout_opts.allow_conflicts(true);
        repo.merge(&[&annotated], Some(&mut merge_opts), Some(&mut checkout_opts))?;

        let mut index = repo.index()?;
        if index.has_conflicts() {
            return Err(GitError::GitFailed {
                code: None,
                stderr: "merge conflicts detected; resolve them in the worktree".to_string(),
            });
        }

        let tree_id = index.write_tree()?;
        let tree = repo.find_tree(tree_id)?;
        let sig = repo.signature()?;

        let head = repo.head()?.target().ok_or_else(|| GitError::GitFailed {
            code: None,
            stderr: "target branch has no commits".to_string(),
        })?;
        let head_commit = repo.find_commit(head)?;
        let their_commit = repo.find_commit(annotated_id)?;
        let message = format!("Merge {source_branch} into {target_branch}");
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &message,
            &tree,
            &[&head_commit, &their_commit],
        )?;
        let mut checkout = build::CheckoutBuilder::new();
        checkout.force();
        repo.checkout_head(Some(&mut checkout))?;
        repo.cleanup_state()?;
    }

    if created_stash {
        if let Err(err) = repo.stash_pop(0, None) {
            return Err(GitError::GitFailed {
                code: None,
                stderr: format!(
                    "merge succeeded, but failed to re-apply stashed changes; resolve manually: {err}"
                ),
            });
        }
    }

    if switched {
        if let Some(original_head) = original_head {
            let _ = checkout_branch(&repo, &original_head);
        }
    }

    Ok(())
}

pub fn rebase_branch(
    repo_root: &Path,
    target_branch: &str,
    onto_branch: &str,
) -> Result<(), GitError> {
    let repo = open_repo(repo_root)?;
    if target_branch.trim().is_empty() || onto_branch.trim().is_empty() {
        return Err(GitError::GitFailed {
            code: None,
            stderr: "targetBranch and ontoBranch are required".to_string(),
        });
    }
    if target_branch == onto_branch {
        return Err(GitError::GitFailed {
            code: None,
            stderr: "targetBranch and ontoBranch must be different".to_string(),
        });
    }

    let target_refname = {
        let target_ref = repo.find_branch(target_branch, BranchType::Local)?;
        target_ref
            .get()
            .name()
            .ok_or_else(|| GitError::GitFailed {
                code: None,
                stderr: "target branch refname is invalid".to_string(),
            })?
            .to_string()
    };

    let _onto_refname = {
        let onto_ref = repo.find_branch(onto_branch, BranchType::Local)?;
        onto_ref
            .get()
            .name()
            .ok_or_else(|| GitError::GitFailed {
                code: None,
                stderr: "onto branch refname is invalid".to_string(),
            })?
            .to_string()
    };

    let original_head = repo
        .head()
        .ok()
        .and_then(|head| head.name().map(|name| name.to_string()));
    let switched = original_head
        .as_deref()
        .map(|name| name != target_refname)
        .unwrap_or(true);

    if switched {
        checkout_branch(&repo, &target_refname)?;
    }

    run_git_command(repo_root, ["rebase", "--autostash", onto_branch])?;

    if switched {
        if let Some(original_head) = original_head {
            let _ = checkout_branch(&repo, &original_head);
        }
    }

    Ok(())
}

pub fn reset(repo_root: &Path, target: &str, mode: &str) -> Result<(), GitError> {
    let repo = open_repo(repo_root)?;
    let obj = repo.revparse_single(target)?;
    let reset_type = match mode {
        "soft" => ResetType::Soft,
        "mixed" => ResetType::Mixed,
        "hard" => ResetType::Hard,
        _ => ResetType::Mixed,
    };

    // For hard reset, we need checkout builder
    let mut checkout = build::CheckoutBuilder::new();
    if mode == "hard" {
        checkout.force();
    }

    repo.reset(&obj, reset_type, Some(&mut checkout))?;
    Ok(())
}

pub fn revert(repo_root: &Path, commit_str: &str) -> Result<(), GitError> {
    let repo = open_repo(repo_root)?;
    let obj = repo.revparse_single(commit_str)?;
    let commit = obj.peel_to_commit()?;

    let mut opts = RevertOptions::new();
    repo.revert(&commit, Some(&mut opts))?;

    // Auto-commit the revert if possible, or leave it staged if conflicts or if that's standard behavior.
    // git revert usually commits unless -n is passed. git2 revert only updates index and worktree.
    // We should try to commit if index is clean (no conflicts).

    let mut index = repo.index()?;
    if index.has_conflicts() {
        return Err(GitError::GitFailed {
            code: None,
            stderr: "revert resulted in conflicts; resolve them manually".to_string(),
        });
    }

    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let sig = repo.signature()?;
    let head = repo.head()?.target().ok_or_else(|| GitError::GitFailed {
        code: None,
        stderr: "HEAD invalid".to_string(),
    })?;
    let head_commit = repo.find_commit(head)?;

    let message = format!("Revert \"{}\"", commit.summary().unwrap_or(""));

    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &message,
        &tree,
        &[&head_commit],
    )?;

    repo.cleanup_state()?;
    Ok(())
}

/// Helper struct for building and validating commit graphs during squash operations.
struct CommitGraph {
    /// Set of selected commit OIDs
    selected_set: HashSet<Oid>,
    /// Base commit OID (parent of oldest selected commit)
    base_oid: Oid,
}

impl CommitGraph {
    /// Build a commit graph from the given commit IDs.
    ///
    /// Validates that:
    /// - No merge commits are selected
    /// - Commits form a single linear range
    /// - Commits are contiguous
    fn build(repo: &Repository, commit_ids: &[String]) -> Result<Self, GitError> {
        let mut parent_map: HashMap<Oid, Option<Oid>> = HashMap::new();
        let mut selected_set = HashSet::new();

        // Parse and validate commits
        for commit_str in commit_ids {
            let oid = resolve_commit_oid(repo, commit_str)?;
            if selected_set.contains(&oid) {
                continue;
            }
            let commit = repo.find_commit(oid)?;

            // Cannot squash merge commits
            if commit.parent_count() > 1 {
                return Err(GitError::GitFailed {
                    code: None,
                    stderr: "cannot squash merge commits".to_string(),
                });
            }

            let parent = if commit.parent_count() == 1 {
                commit.parent_id(0).ok()
            } else {
                None
            };
            parent_map.insert(oid, parent);
            selected_set.insert(oid);
        }

        // Find newest commits (those without selected parents)
        let parent_set: HashSet<Oid> = parent_map
            .values()
            .filter_map(|parent| parent.as_ref().copied())
            .filter(|parent| selected_set.contains(parent))
            .collect();

        let newest_candidates: Vec<Oid> = selected_set
            .iter()
            .copied()
            .filter(|oid| !parent_set.contains(oid))
            .collect();

        // Must have exactly one newest commit
        if newest_candidates.len() != 1 {
            return Err(GitError::GitFailed {
                code: None,
                stderr: "selected commits must be a single linear range".to_string(),
            });
        }

        // Build ordered list from newest to oldest
        let mut ordered_newest = Vec::new();
        let mut cursor = newest_candidates[0];
        loop {
            ordered_newest.push(cursor);
            let parent = parent_map
                .get(&cursor)
                .and_then(|parent| *parent);
            if let Some(parent_oid) = parent {
                if selected_set.contains(&parent_oid) {
                    cursor = parent_oid;
                    continue;
                }
            }
            break;
        }

        // Verify contiguity
        if ordered_newest.len() != selected_set.len() {
            return Err(GitError::GitFailed {
                code: None,
                stderr: "selected commits must be contiguous".to_string(),
            });
        }

        ordered_newest.reverse();
        let oldest = ordered_newest[0];
        let base_oid = parent_map
            .get(&oldest)
            .and_then(|parent| *parent)
            .ok_or_else(|| GitError::GitFailed {
                code: None,
                stderr: "cannot squash the root commit".to_string(),
            })?;

        Ok(CommitGraph {
            selected_set,
            base_oid,
        })
    }

    /// Returns the set of selected commit OIDs.
    fn selected(&self) -> &HashSet<Oid> {
        &self.selected_set
    }

    /// Returns the base commit OID.
    fn base(&self) -> Oid {
        self.base_oid
    }
}

/// Squash commits by replaying them onto the base commit.
///
/// This function cherry-picks each commit in order, squashing selected commits
/// together into a single commit with combined messages.
fn replay_commits_squashed(
    repo: &mut Repository,
    graph: &CommitGraph,
    committer: &git2::Signature,
) -> Result<Oid, GitError> {
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.hide(graph.base())?;
    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::REVERSE)?;
    let commits_to_replay: Vec<Oid> = revwalk.filter_map(Result::ok).collect();

    let commits_to_replay_set: HashSet<Oid> = commits_to_replay.iter().copied().collect();
    let selected = graph.selected();

    // Verify all selected commits are on current branch
    if !selected.is_subset(&commits_to_replay_set) {
        return Err(GitError::GitFailed {
            code: None,
            stderr: "selected commits are not on the current branch".to_string(),
        });
    }

    let mut current_oid = graph.base();
    let mut squashing = false;
    let mut squash_parent = graph.base();
    let mut squash_messages: Vec<String> = Vec::new();
    let mut squash_author: Option<git2::Signature<'static>> = None;

    for oid in commits_to_replay {
        let commit = repo.find_commit(oid)?;
        let current_commit = repo.find_commit(current_oid)?;
        let mut index = repo.cherrypick_commit(&commit, &current_commit, 0, None)?;

        if index.has_conflicts() {
            return Err(GitError::GitFailed {
                code: None,
                stderr: "squash resulted in conflicts; resolve them manually".to_string(),
            });
        }

        let tree_id = index.write_tree_to(repo)?;
        let tree = repo.find_tree(tree_id)?;

        if selected.contains(&oid) {
            // Squash mode: combine commit messages
            if !squashing {
                squashing = true;
                squash_parent = current_oid;
                squash_messages.clear();
                squash_messages.push(commit.message().unwrap_or("").trim_end().to_string());
                squash_author = Some(signature_from_commit(&commit)?);
            } else {
                squash_messages.push(commit.message().unwrap_or("").trim_end().to_string());
            }

            let message = squash_messages.join("\n\n");
            let author = squash_author.as_ref().ok_or_else(|| GitError::GitFailed {
                code: None,
                stderr: "failed to resolve squash author".to_string(),
            })?;
            let parent_commit = repo.find_commit(squash_parent)?;
            let new_oid = repo.commit(
                None,
                author,
                committer,
                &message,
                &tree,
                &[&parent_commit],
            )?;
            current_oid = new_oid;
        } else {
            // Normal mode: replay commit as-is
            squashing = false;
            squash_messages.clear();
            squash_author = None;

            let author = signature_from_commit(&commit)?;
            let message = commit.message().unwrap_or("").to_string();
            let parent_commit = repo.find_commit(current_oid)?;
            let new_oid = repo.commit(
                None,
                &author,
                committer,
                &message,
                &tree,
                &[&parent_commit],
            )?;
            current_oid = new_oid;
        }
    }

    Ok(current_oid)
}

pub fn squash_commits(repo_root: &Path, commit_ids: &[String]) -> Result<(), GitError> {
    if commit_ids.len() < 2 {
        return Err(GitError::GitFailed {
            code: None,
            stderr: "select at least two commits to squash".to_string(),
        });
    }

    let mut repo = open_repo(repo_root)?;
    let created_stash =
        maybe_create_auto_stash(&mut repo, "parallel-cli-runner: auto-stash before squash")?;

    let result = (|| -> Result<(), GitError> {
        let committer = repo.signature()?;

        // Build and validate commit graph
        let graph = CommitGraph::build(&repo, commit_ids)?;

        // Replay commits with squashing
        let current_oid = replay_commits_squashed(&mut repo, &graph, &committer)?;

        // Update branch reference
        let head = repo.head()?;
        let head_name = head.name().ok_or_else(|| GitError::GitFailed {
            code: None,
            stderr: "HEAD is detached".to_string(),
        })?;
        if !head.is_branch() {
            return Err(GitError::GitFailed {
                code: None,
                stderr: "squash requires an attached branch".to_string(),
            });
        }

        let mut reference = repo.find_reference(head_name)?;
        reference.set_target(current_oid, "squash commits")?;
        repo.set_head(head_name)?;

        let mut checkout = build::CheckoutBuilder::new();
        checkout.force();
        repo.checkout_head(Some(&mut checkout))?;

        Ok(())
    })();

    if result.is_err() {
        if created_stash {
            let _ = repo.stash_pop(0, None);
        }
        return result;
    }

    if created_stash {
        restore_auto_stash(&mut repo, "Squash succeeded, but failed to restore stashed changes")?;
    }

    Ok(())
}

pub fn commits_in_remote(repo_root: &Path, commit_ids: &[String]) -> Result<bool, GitError> {
    if commit_ids.is_empty() {
        return Ok(false);
    }

    let repo = open_repo(repo_root)?;
    let remote_refs = repo.references_glob("refs/remotes/*")?;
    let mut remote_heads = Vec::new();

    for reference in remote_refs {
        let reference = reference?;
        if let Ok(commit) = reference.peel_to_commit() {
            remote_heads.push(commit.id());
        }
    }

    if remote_heads.is_empty() {
        return Ok(false);
    }

    for commit_str in commit_ids {
        let oid = resolve_commit_oid(&repo, commit_str)?;
        for remote_oid in &remote_heads {
            if *remote_oid == oid || repo.graph_descendant_of(*remote_oid, oid)? {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

fn signature_from_commit(commit: &git2::Commit<'_>) -> Result<git2::Signature<'static>, GitError> {
    let author = commit.author();
    let name = author.name().unwrap_or("unknown");
    let email = author.email().unwrap_or("unknown");
    let time = author.when();
    git2::Signature::new(name, email, &time).map_err(GitError::Git2)
}

fn resolve_commit_oid(repo: &Repository, commit_str: &str) -> Result<Oid, GitError> {
    let obj = repo.revparse_single(commit_str)?;
    let commit = obj.peel_to_commit()?;
    Ok(commit.id())
}

fn is_repo_dirty(repo: &Repository) -> Result<bool, GitError> {
    let mut opts = git2::StatusOptions::new();
    opts.show(git2::StatusShow::IndexAndWorkdir)
        .include_untracked(true)
        .recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts))?;
    for entry in statuses.iter() {
        let status = entry.status();
        if status != git2::Status::CURRENT && !status.contains(git2::Status::IGNORED) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn maybe_create_auto_stash(repo: &mut Repository, message: &str) -> Result<bool, GitError> {
    if !is_repo_dirty(repo)? {
        return Ok(false);
    }
    let sig = repo.signature()?;
    repo.stash_save(&sig, message, Some(StashFlags::INCLUDE_UNTRACKED))?;
    Ok(true)
}

fn restore_auto_stash(repo: &mut Repository, context: &str) -> Result<(), GitError> {
    if let Err(err) = repo.stash_pop(0, None) {
        return Err(GitError::GitFailed {
            code: None,
            stderr: format!("{context}: {err}"),
        });
    }
    Ok(())
}

fn run_git_command<I, S>(cwd: &Path, args: I) -> Result<std::process::Output, GitError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    let mut cmd = Command::new("git");
    cmd.args(args).current_dir(cwd);

    let proxy_url = configure_proxy(&mut cmd);
    let output = cmd.output().map_err(GitError::Io)?;

    if !output.status.success() {
        let mut stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if let Some(url) = proxy_url {
            use std::fmt::Write;
            let _ = write!(
                stderr,
                "\n[parallel-cli-runner] System proxy detected and used: {}",
                url
            );
        }

        return Err(GitError::GitFailed {
            code: output.status.code(),
            stderr,
        });
    }
    Ok(output)
}

fn format_relative_time(time: git2::Time) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let seconds = now.saturating_sub(time.seconds());
    format_relative_duration(seconds)
}

fn format_relative_duration(seconds: i64) -> String {
    let seconds = seconds.max(0);
    if seconds < 60 {
        return format_relative_unit(seconds.max(1), "second");
    }
    let minutes = seconds / 60;
    if minutes < 60 {
        return format_relative_unit(minutes, "minute");
    }
    let hours = minutes / 60;
    if hours < 24 {
        return format_relative_unit(hours, "hour");
    }
    let days = hours / 24;
    if days < 7 {
        return format_relative_unit(days, "day");
    }
    let weeks = days / 7;
    if weeks < 5 {
        return format_relative_unit(weeks, "week");
    }
    let months = days / 30;
    if months < 12 {
        return format_relative_unit(months.max(1), "month");
    }
    let years = days / 365;
    format_relative_unit(years.max(1), "year")
}

fn format_relative_unit(value: i64, unit: &str) -> String {
    if value == 1 {
        format!("1 {unit} ago")
    } else {
        format!("{value} {unit}s ago")
    }
}
