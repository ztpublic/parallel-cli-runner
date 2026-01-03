use crate::git::error::GitError;
use crate::git::scanner::canonicalize_path;
use crate::git::types::{CommitInfoDto, FileChangeType, FileStats, FileStatusDto, RepoStatusDto, SubmoduleInfoDto};
use git2::{Diff, DiffOptions, ErrorCode, IndexAddOption, Repository, Status, StatusOptions, StatusShow};
use std::io::BufRead;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn status(cwd: &std::path::Path) -> Result<RepoStatusDto, GitError> {
    let repo = open_repo(cwd)?;
    let repo_root = repo_root_path(&repo);
    let (branch, ahead, behind) = branch_status(&repo)?;

    let mut opts = StatusOptions::new();
    opts.show(StatusShow::IndexAndWorkdir)
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true)
        .renames_from_rewrites(true);

    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(statuses) => Some(statuses),
        Err(err) if err.code() == ErrorCode::NotFound => None,
        Err(err) => return Err(GitError::Git2(err)),
    };
    let mut has_untracked = false;
    let mut has_staged = false;
    let mut has_unstaged = false;
    let mut conflicted_files = 0usize;
    let mut modified_files = Vec::new();

    if let Some(statuses) = statuses {
        for entry in statuses.iter() {
            let status = entry.status();
            if status.contains(Status::IGNORED) || status == Status::CURRENT {
                continue;
            }

            let Some(path) = entry.path() else {
                continue;
            };

            let (staged, unstaged, conflicted) = if status.contains(Status::CONFLICTED) {
                (Some(FileChangeType::Unmerged), Some(FileChangeType::Unmerged), true)
            } else {
                (map_index_status(status), map_worktree_status(status), false)
            };
            if conflicted {
                conflicted_files += 1;
                has_staged = true;
                has_unstaged = true;
            }

            if status.contains(Status::WT_NEW) {
                has_untracked = true;
            }
            if staged.is_some() {
                has_staged = true;
            }
            if unstaged.is_some() {
                has_unstaged = true;
            }

            if staged.is_none() && unstaged.is_none() {
                continue;
            }

            let staged_stats = if staged.is_some() {
                get_file_diff_stats(&repo, path, true).ok()
            } else {
                None
            };

            let unstaged_stats = if unstaged.is_some() {
                get_file_diff_stats(&repo, path, false).ok()
            } else {
                None
            };

            modified_files.push(FileStatusDto {
                path: path.to_string(),
                staged,
                unstaged,
                staged_stats,
                unstaged_stats,
            });
        }
    }

    Ok(RepoStatusDto {
        repo_id: repo_root.to_string_lossy().to_string(),
        root_path: repo_root.to_string_lossy().to_string(),
        branch,
        ahead,
        behind,
        has_untracked,
        has_staged,
        has_unstaged,
        conflicted_files,
        modified_files,
        latest_commit: latest_commit_for_repo(&repo)?,
    })
}

pub fn diff(cwd: &std::path::Path, pathspecs: &[String]) -> Result<String, GitError> {
    let repo = open_repo(cwd)?;
    let mut opts = DiffOptions::new();
    for pathspec in pathspecs {
        opts.pathspec(pathspec);
    }
    let diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;
    let stats = diff.stats()?;
    let buf = stats.to_buf(git2::DiffStatsFormat::NUMBER, 80)?;
    Ok(buf.as_str().unwrap_or_default().to_string())
}

pub fn diff_stats_worktree(worktree: &std::path::Path) -> Result<crate::git::types::DiffStatDto, GitError> {
    let repo = open_repo(worktree)?;
    let head_tree = match repo.head() {
        Ok(head) => Some(head.peel_to_tree()?),
        Err(err) if err.code() == ErrorCode::UnbornBranch => None,
        Err(err) => return Err(GitError::Git2(err)),
    };
    let mut opts = DiffOptions::new();
    let diff = repo.diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))?;
    let mut summary = diff_stats_from_diff(&diff)?;

    let (untracked_count, untracked_insertions) = untracked_stats(&repo)?;
    if untracked_count > 0 {
        summary.files_changed += untracked_count;
        summary.insertions += untracked_insertions;
    }

    Ok(summary)
}

pub fn diff_stats_against_branch(
    worktree: &std::path::Path,
    base_branch: &str,
) -> Result<crate::git::types::DiffStatDto, GitError> {
    let repo = open_repo(worktree)?;
    let obj = repo.revparse_single(base_branch)?;
    let tree = obj.peel_to_tree()?;
    let mut opts = DiffOptions::new();
    let diff = repo.diff_tree_to_workdir_with_index(Some(&tree), Some(&mut opts))?;
    diff_stats_from_diff(&diff)
}

pub fn stage_paths(cwd: &std::path::Path, paths: &[String]) -> Result<(), GitError> {
    if paths.is_empty() {
        return Ok(());
    }
    let repo = open_repo(cwd)?;
    let mut index = repo.index()?;
    for path in paths {
        index.add_path(std::path::Path::new(path))?;
    }
    index.write()?;
    Ok(())
}

pub fn unstage_paths(cwd: &std::path::Path, paths: &[String]) -> Result<(), GitError> {
    if paths.is_empty() {
        return Ok(());
    }
    let repo = open_repo(cwd)?;
    let head = match repo.head() {
        Ok(head) => match head.target() {
            Some(oid) => Some(repo.find_object(oid, None)?),
            None => None,
        },
        Err(err) if err.code() == ErrorCode::UnbornBranch => None,
        Err(err) => return Err(GitError::Git2(err)),
    };
    repo.reset_default(head.as_ref(), paths.iter().map(|path| path.as_str()))?;
    Ok(())
}

pub fn discard_paths(cwd: &std::path::Path, paths: &[String]) -> Result<(), GitError> {
    if paths.is_empty() {
        return Ok(());
    }
    let repo = open_repo(cwd)?;
    let head_oid = match repo.head() {
        Ok(head) => head.target(),
        Err(err) if err.code() == ErrorCode::UnbornBranch => None,
        Err(err) => return Err(GitError::Git2(err)),
    };

    let (head_obj, head_tree) = if let Some(oid) = head_oid {
        (
            Some(repo.find_object(oid, None)?),
            Some(repo.find_commit(oid)?.tree()?),
        )
    } else {
        (None, None)
    };

    if let Some(ref obj) = head_obj {
        repo.reset_default(Some(obj), paths.iter().map(|path| path.as_str()))?;
    } else {
        let mut index = repo.index()?;
        for path in paths {
            match index.remove_path(std::path::Path::new(path)) {
                Ok(()) => {}
                Err(err) if err.code() == ErrorCode::NotFound => {}
                Err(err) => return Err(GitError::Git2(err)),
            }
        }
        index.write()?;
    }

    let workdir = repo.workdir().ok_or_else(|| GitError::GitFailed {
        code: None,
        stderr: "cannot discard files in bare repo".to_string(),
    })?;
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force();
    let mut should_checkout = false;

    for path in paths {
        let tracked = head_tree
            .as_ref()
            .map(|tree| tree.get_path(std::path::Path::new(path)).is_ok())
            .unwrap_or(false);
        if tracked {
            checkout.path(path);
            should_checkout = true;
        } else {
            let full_path = workdir.join(path);
            if full_path.is_dir() {
                std::fs::remove_dir_all(&full_path)?;
            } else if full_path.exists() {
                std::fs::remove_file(&full_path)?;
            }
        }
    }

    if should_checkout {
        repo.checkout_head(Some(&mut checkout))?;
    }

    Ok(())
}

pub fn stage_all(cwd: &std::path::Path) -> Result<(), GitError> {
    let repo = open_repo(cwd)?;
    let mut index = repo.index()?;
    index.add_all(["."].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

pub fn unstage_all(cwd: &std::path::Path) -> Result<(), GitError> {
    let staged_paths = staged_paths(cwd)?;
    unstage_paths(cwd, &staged_paths)
}

pub fn open_repo(cwd: &std::path::Path) -> Result<Repository, GitError> {
    match Repository::discover(cwd) {
        Ok(repo) => Ok(repo),
        Err(err) if err.code() == ErrorCode::NotFound => Err(GitError::GitFailed {
            code: None,
            stderr: "not a git repository".to_string(),
        }),
        Err(err) => Err(GitError::Git2(err)),
    }
}

fn repo_root_path(repo: &Repository) -> std::path::PathBuf {
    if let Some(workdir) = repo.workdir() {
        canonicalize_path(workdir)
    } else {
        canonicalize_path(repo.path())
    }
}

fn branch_status(repo: &Repository) -> Result<(String, i32, i32), GitError> {
    let head = match repo.head() {
        Ok(head) => head,
        Err(err) if err.code() == ErrorCode::UnbornBranch => {
            return Ok(("HEAD".to_string(), 0, 0));
        }
        Err(err) if err.code() == ErrorCode::NotFound => {
            return Ok(("HEAD".to_string(), 0, 0));
        }
        Err(err) => return Err(GitError::Git2(err)),
    };

    let branch = head.shorthand().unwrap_or("HEAD").to_string();
    let mut ahead = 0i32;
    let mut behind = 0i32;

    let is_branch = head
        .name()
        .map(|name| name.starts_with("refs/heads/"))
        .unwrap_or(false);
    if is_branch {
        if let Ok(branch_ref) = repo.find_branch(&branch, git2::BranchType::Local) {
            if let Ok(upstream) = branch_ref.upstream() {
                if let (Some(local_oid), Some(upstream_oid)) =
                    (head.target(), upstream.get().target())
                {
                    let (a, b) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
                    ahead = a as i32;
                    behind = b as i32;
                }
            }
        }
    }

    Ok((branch, ahead, behind))
}

fn map_index_status(status: Status) -> Option<FileChangeType> {
    if status.contains(Status::INDEX_RENAMED) {
        Some(FileChangeType::Renamed)
    } else if status.contains(Status::INDEX_NEW) {
        Some(FileChangeType::Added)
    } else if status.contains(Status::INDEX_DELETED) {
        Some(FileChangeType::Deleted)
    } else if status.contains(Status::INDEX_MODIFIED) || status.contains(Status::INDEX_TYPECHANGE) {
        Some(FileChangeType::Modified)
    } else {
        None
    }
}

fn map_worktree_status(status: Status) -> Option<FileChangeType> {
    if status.contains(Status::WT_RENAMED) {
        Some(FileChangeType::Renamed)
    } else if status.contains(Status::WT_NEW) {
        Some(FileChangeType::Added)
    } else if status.contains(Status::WT_DELETED) {
        Some(FileChangeType::Deleted)
    } else if status.contains(Status::WT_MODIFIED) || status.contains(Status::WT_TYPECHANGE) {
        Some(FileChangeType::Modified)
    } else {
        None
    }
}

fn diff_stats_from_diff(diff: &Diff<'_>) -> Result<crate::git::types::DiffStatDto, GitError> {
    let stats = diff.stats()?;
    Ok(crate::git::types::DiffStatDto {
        files_changed: stats.files_changed(),
        insertions: stats.insertions() as i32,
        deletions: stats.deletions() as i32,
    })
}

fn is_repo_dirty(repo: &Repository) -> Result<bool, GitError> {
    let mut opts = StatusOptions::new();
    opts.show(StatusShow::IndexAndWorkdir)
        .include_untracked(true)
        .recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts))?;
    for entry in statuses.iter() {
        let status = entry.status();
        if status != Status::CURRENT && !status.contains(Status::IGNORED) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn latest_commit_for_repo(repo: &Repository) -> Result<Option<CommitInfoDto>, GitError> {
    let head = match repo.head() {
        Ok(head) => head,
        Err(err) if err.code() == ErrorCode::UnbornBranch => return Ok(None),
        Err(err) if err.code() == ErrorCode::NotFound => return Ok(None),
        Err(err) => return Err(GitError::Git2(err)),
    };
    let Some(oid) = head.target() else {
        return Ok(None);
    };
    let commit = repo.find_commit(oid)?;
    let summary = commit.summary().unwrap_or_default().to_string();
    let author = commit.author().name().unwrap_or_default().to_string();
    let relative_time = format_relative_time(commit.time());
    Ok(Some(CommitInfoDto {
        id: commit.id().to_string(),
        summary,
        author,
        relative_time,
    }))
}

fn staged_paths(cwd: &std::path::Path) -> Result<Vec<String>, GitError> {
    let repo = open_repo(cwd)?;
    let mut opts = StatusOptions::new();
    opts.show(StatusShow::IndexAndWorkdir)
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true)
        .renames_from_rewrites(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut paths = Vec::new();
    for entry in statuses.iter() {
        let status = entry.status();
        if status.contains(Status::IGNORED) || status == Status::CURRENT {
            continue;
        }
        let Some(path) = entry.path() else {
            continue;
        };
        if map_index_status(status).is_some() || status.contains(Status::CONFLICTED) {
            paths.push(path.to_string());
        }
    }
    Ok(paths)
}

fn format_relative_time(time: git2::Time) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
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

fn get_file_diff_stats(repo: &Repository, path: &str, staged: bool) -> Result<FileStats, GitError> {
    let mut opts = DiffOptions::new();
    opts.pathspec(path);
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);

    let diff = if staged {
        if let Ok(head_tree) = repo.head().and_then(|h| h.peel_to_tree()) {
            repo.diff_tree_to_index(Some(&head_tree), Some(&repo.index()?), Some(&mut opts))?
        } else {
            repo.diff_tree_to_index(None, Some(&repo.index()?), Some(&mut opts))?
        }
    } else {
        repo.diff_index_to_workdir(None, Some(&mut opts))?
    };

    let stats = diff.stats()?;
    let mut insertions = stats.insertions() as i32;
    let deletions = stats.deletions() as i32;

    if !staged && insertions == 0 && deletions == 0 {
        if let Some(delta) = diff.deltas().next() {
            if delta.status() == git2::Delta::Untracked {
                if let Some(workdir) = repo.workdir() {
                    if let Ok(file) = std::fs::File::open(workdir.join(path)) {
                        let reader = std::io::BufReader::new(file);
                        insertions = reader.lines().count() as i32;
                    }
                }
            }
        }
    }

    Ok(FileStats {
        insertions,
        deletions,
    })
}

fn untracked_stats(repo: &Repository) -> Result<(usize, i32), GitError> {
    let Some(workdir) = repo.workdir() else {
        return Ok((0, 0));
    };

    let mut opts = StatusOptions::new();
    opts.show(StatusShow::Workdir)
        .include_untracked(true)
        .recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut count = 0usize;
    let mut insertions = 0i32;

    for entry in statuses.iter() {
        let status = entry.status();
        if status.contains(Status::IGNORED) || !status.contains(Status::WT_NEW) {
            continue;
        }
        let Some(path) = entry.path() else {
            continue;
        };
        count += 1;
        let full_path = workdir.join(path);
        if let Ok(contents) = std::fs::read_to_string(&full_path) {
            let lines = if contents.is_empty() {
                0
            } else {
                contents.lines().count()
            };
            insertions += lines as i32;
        }
    }

    Ok((count, insertions))
}

pub fn list_submodules(cwd: &Path) -> Result<Vec<SubmoduleInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let Some(workdir) = repo.workdir() else {
        return Ok(Vec::new());
    };

    let submodules = match repo.submodules() {
        Ok(submodules) => submodules,
        Err(err) if err.code() == ErrorCode::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(GitError::Git2(err)),
    };

    let mut modules = Vec::new();
    for submodule in submodules {
        let name = submodule
            .name()
            .map(|name| name.to_string())
            .unwrap_or_else(|| submodule.path().to_string_lossy().to_string());
        let path = workdir.join(submodule.path());
        let url = submodule.url().map(|url| url.to_string());
        modules.push(SubmoduleInfoDto {
            name,
            path: path.to_string_lossy().to_string(),
            url,
        });
    }

    modules.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(modules)
}
