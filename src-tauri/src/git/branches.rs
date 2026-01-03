use crate::git::error::GitError;
use crate::git::status::open_repo;
use crate::git::types::BranchInfoDto;
use git2::{BranchType, ErrorCode, Repository};
use std::path::Path;

pub fn list_branches(cwd: &Path) -> Result<Vec<BranchInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let mut branches = Vec::new();
    for branch in repo.branches(Some(BranchType::Local))? {
        let (branch, _branch_type) = match branch {
            Ok(branch) => branch,
            Err(err) if err.code() == ErrorCode::NotFound => continue,
            Err(err) => return Err(GitError::Git2(err)),
        };
        let name = branch.name()?.unwrap_or_default().to_string();
        if !name.is_empty() {
            let last_commit = match branch_last_commit(&branch) {
                Ok(last_commit) => last_commit,
                Err(GitError::Git2(err)) if err.code() == ErrorCode::NotFound => continue,
                Err(err) => return Err(err),
            };

            let (ahead, behind) = get_branch_ahead_behind(&repo, &branch).unwrap_or((0, 0));

            branches.push(BranchInfoDto {
                name,
                current: branch.is_head(),
                last_commit,
                ahead: ahead as i32,
                behind: behind as i32,
            });
        }
    }
    Ok(branches)
}

pub fn list_remote_branches(cwd: &Path) -> Result<Vec<BranchInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let mut branches = Vec::new();
    for branch in repo.branches(Some(BranchType::Remote))? {
        let (branch, _branch_type) = match branch {
            Ok(branch) => branch,
            Err(err) if err.code() == ErrorCode::NotFound => continue,
            Err(err) => return Err(GitError::Git2(err)),
        };
        let Some(name) = branch.name()? else {
            continue;
        };
        let name = name.to_string();
        if name.is_empty() || name.ends_with("/HEAD") {
            continue;
        }
        let last_commit = match branch_last_commit(&branch) {
            Ok(last_commit) => last_commit,
            Err(GitError::Git2(err)) if err.code() == ErrorCode::NotFound => continue,
            Err(err) => return Err(err),
        };
        branches.push(BranchInfoDto {
            name,
            current: false,
            last_commit,
            ahead: 0,
            behind: 0,
        });
    }
    Ok(branches)
}

pub fn default_branch(cwd: &Path) -> Result<String, GitError> {
    let repo = open_repo(cwd)?;

    if let Ok(reference) = repo.find_reference("refs/remotes/origin/HEAD") {
        if let Some(target) = reference.symbolic_target() {
            let local = target.strip_prefix("refs/remotes/origin/").unwrap_or(target);
            if branch_exists_in_repo(&repo, local)? {
                return Ok(local.to_string());
            }
        }
    }

    for candidate in ["main", "master"] {
        if branch_exists_in_repo(&repo, candidate)? {
            return Ok(candidate.to_string());
        }
    }

    current_branch_from_repo(&repo)
}

pub fn current_branch(cwd: &Path) -> Result<String, GitError> {
    let repo = open_repo(cwd)?;
    let head = match repo.head() {
        Ok(head) => head,
        Err(err) if err.code() == ErrorCode::UnbornBranch => {
            return Ok("HEAD".to_string());
        }
        Err(err) => return Err(GitError::Git2(err)),
    };
    Ok(head.shorthand().unwrap_or("HEAD").to_string())
}

pub fn branch_exists(cwd: &Path, branch: &str) -> Result<bool, GitError> {
    let repo = open_repo(cwd)?;
    branch_exists_in_repo(&repo, branch)
}

pub fn create_branch(
    repo_root: &Path,
    name: &str,
    source_branch: Option<String>,
) -> Result<(), GitError> {
    let repo = open_repo(repo_root)?;
    let start_point = match source_branch {
        Some(b) => b,
        None => current_branch_from_repo(&repo)?,
    };

    let obj = repo.revparse_single(&start_point)?;
    let commit = obj.peel_to_commit()?;

    repo.branch(name, &commit, false)?;
    Ok(())
}

pub fn delete_branch(repo_root: &Path, branch: &str, force: bool) -> Result<(), GitError> {
    let repo = open_repo(repo_root)?;
    if force {
        let refname = local_branch_refname(branch);
        let mut reference = repo.find_reference(&refname)?;
        reference.delete()?;
        return Ok(());
    }

    let mut branch_ref = repo.find_branch(branch, BranchType::Local)?;
    branch_ref.delete()?;
    Ok(())
}

pub fn checkout_local_branch(repo_root: &Path, branch_name: &str) -> Result<(), GitError> {
    let repo = open_repo(repo_root)?;
    let refname = local_branch_refname(branch_name);
    checkout_branch(&repo, &refname)
}

pub fn smart_checkout_branch(repo_root: &Path, branch_name: &str) -> Result<(), GitError> {
    let mut repo = open_repo(repo_root)?;
    let refname = local_branch_refname(branch_name);

    // 1. Stash changes
    let created_stash = maybe_create_auto_stash(
        &mut repo,
        &format!(
            "parallel-cli-runner: auto-stash before switching to {}",
            branch_name
        ),
    )?;

    // 2. Checkout branch
    // Use force because we just stashed, so we expect a clean state for checkout.
    // However, if stash failed or didn't happen, we might not want to force?
    // But if is_repo_dirty returned false, force is safe.
    // If stash succeeded, force is safe.
    if let Err(err) = checkout_branch(&repo, &refname) {
        if created_stash {
            // Restore stash if checkout failed
            let _ = repo.stash_pop(0, None);
        }
        return Err(err);
    }

    // 3. Pop stash
    if created_stash {
        restore_auto_stash(&mut repo, "Switch successful, but failed to restore stashed changes")?;
    }

    Ok(())
}

fn branch_last_commit(branch: &git2::Branch<'_>) -> Result<String, GitError> {
    let commit = branch.get().peel_to_commit()?;
    Ok(commit.summary().unwrap_or_default().to_string())
}

fn get_branch_ahead_behind(repo: &Repository, branch: &git2::Branch) -> Result<(usize, usize), GitError> {
    if let Ok(upstream) = branch.upstream() {
        if let (Some(local_oid), Some(upstream_oid)) = (branch.get().target(), upstream.get().target()) {
            let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
            return Ok((ahead, behind));
        }
    }
    Ok((0, 0))
}

fn branch_exists_in_repo(repo: &Repository, branch: &str) -> Result<bool, GitError> {
    match repo.find_branch(branch, BranchType::Local) {
        Ok(_) => Ok(true),
        Err(err) if err.code() == ErrorCode::NotFound => Ok(false),
        Err(err) => Err(GitError::Git2(err)),
    }
}

pub fn current_branch_from_repo(repo: &Repository) -> Result<String, GitError> {
    let head = match repo.head() {
        Ok(head) => head,
        Err(err) if err.code() == ErrorCode::UnbornBranch => {
            return Ok("HEAD".to_string());
        }
        Err(err) if err.code() == ErrorCode::NotFound => {
            return Ok("HEAD".to_string());
        }
        Err(err) => return Err(GitError::Git2(err)),
    };
    Ok(head.shorthand().unwrap_or("HEAD").to_string())
}

fn local_branch_refname(branch: &str) -> String {
    if branch.starts_with("refs/") {
        branch.to_string()
    } else {
        format!("refs/heads/{branch}")
    }
}

pub fn checkout_branch(repo: &Repository, refname: &str) -> Result<(), GitError> {
    repo.set_head(refname)?;
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force();
    repo.checkout_head(Some(&mut checkout))?;
    Ok(())
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
    repo.stash_save(&sig, message, Some(git2::StashFlags::INCLUDE_UNTRACKED))?;
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
