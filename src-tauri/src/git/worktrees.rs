use crate::git::branches::current_branch_from_repo;
use crate::git::error::GitError;
use crate::git::proxy::configure_proxy;
use crate::git::scanner::canonicalize_path;
use crate::git::status::open_repo;
use crate::git::types::WorktreeInfoDto;
use git2::ErrorCode;
use std::fs;
use std::path::Path;
use std::process::Command;

pub fn list_worktrees(cwd: &Path) -> Result<Vec<WorktreeInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let mut worktrees = Vec::new();
    let active_head_oid = repo.head().ok().and_then(|head| head.target());

    if let Some(workdir) = repo.workdir() {
        let branch = current_branch_from_repo(&repo)?;
        worktrees.push(WorktreeInfoDto {
            branch,
            path: canonicalize_path(workdir).to_string_lossy().to_string(),
            ahead: 0,
            behind: 0,
        });
    }

    let names = repo.worktrees()?;
    for name in names.iter().flatten() {
        let worktree = match repo.find_worktree(name) {
            Ok(worktree) => worktree,
            Err(err) if err.code() == ErrorCode::NotFound => continue,
            Err(err) => return Err(GitError::Git2(err)),
        };
        let path = worktree.path();

        if !path.exists() {
            // Try to find the branch name before pruning
            let mut branch_to_delete = None;
            let worktree_git_dir = repo.path().join("worktrees").join(name);
            let head_file = worktree_git_dir.join("HEAD");

            if let Ok(content) = fs::read_to_string(&head_file) {
                let content = content.trim();
                if let Some(ref_name) = content.strip_prefix("ref: refs/heads/") {
                    branch_to_delete = Some(ref_name.to_string());
                }
            }

            let mut opts = git2::WorktreePruneOptions::new();
            opts.valid(true);
            if worktree.prune(Some(&mut opts)).is_ok() {
                if let Some(branch_name) = branch_to_delete {
                    if let Ok(mut branch) = repo.find_branch(&branch_name, git2::BranchType::Local) {
                        let _ = branch.delete();
                    }
                }
            }
            continue;
        }

        let (branch, ahead, behind) = match git2::Repository::open(path) {
            Ok(worktree_repo) => {
                let branch = current_branch_from_repo(&worktree_repo)
                    .unwrap_or_else(|_| "HEAD".to_string());
                let worktree_head_oid = worktree_repo.head().ok().and_then(|head| head.target());
                let (ahead, behind) = match (worktree_head_oid, active_head_oid) {
                    (Some(worktree_oid), Some(active_oid)) => repo
                        .graph_ahead_behind(worktree_oid, active_oid)
                        .map(|(ahead, behind)| (ahead as i32, behind as i32))
                        .unwrap_or((0, 0)),
                    _ => (0, 0),
                };
                (branch, ahead, behind)
            }
            Err(_) => ("HEAD".to_string(), 0, 0),
        };
        worktrees.push(WorktreeInfoDto {
            branch,
            path: canonicalize_path(path).to_string_lossy().to_string(),
            ahead,
            behind,
        });
    }

    Ok(worktrees)
}

pub fn add_worktree(
    repo_root: &Path,
    worktree_path: &Path,
    branch: &str,
    start_point: &str,
) -> Result<(), GitError> {
    let repo = open_repo(repo_root)?;
    let start_obj = repo.revparse_single(start_point)?;
    let start_commit = start_obj.peel_to_commit()?;
    let branch_ref = repo.branch(branch, &start_commit, false)?;

    let full_path = if worktree_path.is_absolute() {
        worktree_path.to_path_buf()
    } else {
        repo_root.join(worktree_path)
    };

    let worktree_name = full_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(branch);
    let mut opts = git2::WorktreeAddOptions::new();
    let reference = branch_ref.into_reference();
    opts.reference(Some(&reference));
    repo.worktree(worktree_name, &full_path, Some(&opts))?;

    // Initialize and checkout submodules in the new worktree
    let _ = run_git_command(&full_path, ["-c", "protocol.file.allow=always", "submodule", "update", "--init", "--recursive"]);

    Ok(())
}

pub fn remove_worktree(
    repo_root: &Path,
    worktree_path: &Path,
    force: bool,
) -> Result<(), GitError> {
    let repo = open_repo(repo_root)?;
    let target_path = canonicalize_path(worktree_path);
    let worktrees = repo.worktrees()?;

    for name in worktrees.iter().flatten() {
        let worktree = repo.find_worktree(name)?;
        if canonicalize_path(worktree.path()) == target_path {
            let mut opts = git2::WorktreePruneOptions::new();
            opts.valid(true).working_tree(true);
            if force {
                opts.locked(true);
            }
            worktree.prune(Some(&mut opts))?;
            return Ok(());
        }
    }

    Err(GitError::GitFailed {
        code: None,
        stderr: "worktree not found".to_string(),
    })
}

pub fn detach_worktree_head(worktree_path: &Path) -> Result<(), GitError> {
    let _ = run_git_command(worktree_path, ["checkout", "--detach"])?;
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
