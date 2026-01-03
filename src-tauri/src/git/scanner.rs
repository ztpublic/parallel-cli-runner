use crate::git::error::GitError;
use crate::git::types::RepoInfoDto;
use git2::ErrorCode;
use git2::Repository;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

pub fn detect_repo(cwd: &Path) -> Result<Option<PathBuf>, GitError> {
    match Repository::discover(cwd) {
        Ok(repo) => Ok(Some(repo_root_path(&repo))),
        Err(err) if err.code() == ErrorCode::NotFound => Ok(None),
        Err(err) => Err(GitError::Git2(err)),
    }
}

fn enqueue_submodule_paths(
    repo: &Repository,
    pending: &mut Vec<PathBuf>,
    queued: &mut HashSet<PathBuf>,
) {
    let Some(workdir) = repo.workdir() else {
        return;
    };
    let submodules = match repo.submodules() {
        Ok(submodules) => submodules,
        Err(err) if err.code() == ErrorCode::NotFound => return,
        Err(_) => return,
    };

    for submodule in submodules {
        let path = workdir.join(submodule.path());
        if queued.insert(path.clone()) {
            pending.push(path);
        }
    }
}

fn register_repo(
    repo: &Repository,
    scanned_entries: &mut Vec<(RepoInfoDto, PathBuf)>,
    seen: &mut HashSet<String>,
    pending: &mut Vec<PathBuf>,
    queued: &mut HashSet<PathBuf>,
) {
    let info = repo_info_from_repo(repo);
    if seen.insert(info.root_path.clone()) {
        let git_path = canonicalize_path(repo.path());
        scanned_entries.push((info, git_path));
        enqueue_submodule_paths(repo, pending, queued);
    }
}

pub fn scan_repos<F>(root: &Path, progress_cb: F) -> Result<Vec<RepoInfoDto>, GitError>
where
    F: Fn(String),
{
    let mut seen = HashSet::new();
    let mut scanned_entries = Vec::new();
    let mut pending = Vec::new();
    let mut queued = HashSet::new();

    if queued.insert(root.to_path_buf()) {
        pending.push(root.to_path_buf());
    }

    if let Ok(repo) = Repository::discover(root) {
        register_repo(&repo, &mut scanned_entries, &mut seen, &mut pending, &mut queued);
    }

    while let Some(dir) = pending.pop() {
        progress_cb(dir.to_string_lossy().to_string());
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        let mut is_repo_dir = false;
        let git_marker = dir.join(".git");
        if fs::symlink_metadata(&git_marker).is_ok() {
            if let Ok(repo) = Repository::discover(&dir) {
                register_repo(
                    &repo,
                    &mut scanned_entries,
                    &mut seen,
                    &mut pending,
                    &mut queued,
                );
                is_repo_dir = true;
            }
        } else {
            let head = dir.join("HEAD");
            let objects = dir.join("objects");
            if head.is_file() && objects.is_dir() {
                if let Ok(repo) = Repository::open(&dir) {
                    register_repo(
                        &repo,
                        &mut scanned_entries,
                        &mut seen,
                        &mut pending,
                        &mut queued,
                    );
                    is_repo_dir = true;
                }
            }
        }

        if is_repo_dir {
            continue;
        }

        for entry in entries.flatten() {
            let path = entry.path();
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };

            if metadata.file_type().is_symlink() {
                continue;
            }
            if !metadata.is_dir() {
                continue;
            }
            if path.file_name().and_then(|name| name.to_str()) == Some(".git") {
                continue;
            }

            if queued.insert(path.clone()) {
                pending.push(path);
            }
        }
    }

    let mut repos = Vec::new();
    for (info, git_path) in &scanned_entries {
        let is_worktree = scanned_entries.iter().any(|(_, other_git_path)| {
            if git_path == other_git_path {
                return false;
            }
            if let Ok(relative) = git_path.strip_prefix(other_git_path) {
                // Check if it's a worktree (path inside .git/worktrees/...)
                let mut components = relative.components();
                if let Some(first) = components.next() {
                    return first.as_os_str() == "worktrees";
                }
            }
            false
        });

        if !is_worktree {
            repos.push(info.clone());
        }
    }

    repos.sort_by(|a, b| a.root_path.cmp(&b.root_path));
    Ok(repos)
}

pub fn canonicalize_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn repo_root_path(repo: &Repository) -> PathBuf {
    if let Some(workdir) = repo.workdir() {
        canonicalize_path(workdir)
    } else {
        canonicalize_path(repo.path())
    }
}

fn repo_info_from_repo(repo: &Repository) -> RepoInfoDto {
    let repo_root = repo_root_path(repo);
    let name = repo_root
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_string();

    RepoInfoDto {
        repo_id: repo_root.to_string_lossy().to_string(),
        root_path: repo_root.to_string_lossy().to_string(),
        name,
        is_bare: repo.is_bare(),
    }
}
