use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use thiserror::Error;

#[derive(Debug)]
pub struct GitOutput {
    pub stdout: String,
    #[allow(dead_code)]
    pub stderr: String,
}

#[derive(Error, Debug)]
pub enum GitError {
    #[error("git not found")]
    GitNotFound,
    #[error("git failed: {stderr}")]
    GitFailed { code: Option<i32>, stderr: String },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("utf8 error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
}

pub fn run_git(cwd: &Path, args: &[&str]) -> Result<GitOutput, GitError> {
    let output = Command::new("git")
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                GitError::GitNotFound
            } else {
                e.into()
            }
        })?;

    if output.status.success() {
        Ok(GitOutput {
            stdout: String::from_utf8(output.stdout)?,
            stderr: String::from_utf8(output.stderr)?,
        })
    } else {
        Err(GitError::GitFailed {
            code: output.status.code(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FileChangeType {
    Added,
    Modified,
    Deleted,
    Renamed,
    Unmerged,
}

#[derive(Clone, Debug, Serialize)]
pub struct FileStatusDto {
    pub path: String,
    pub staged: Option<FileChangeType>,
    pub unstaged: Option<FileChangeType>,
}

#[derive(Clone, Debug, Serialize)]
pub struct CommitInfoDto {
    pub id: String,
    pub summary: String,
    pub author: String,
    pub relative_time: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct RepoStatusDto {
    pub repo_id: String,
    pub root_path: String,
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    pub has_untracked: bool,
    pub has_staged: bool,
    pub has_unstaged: bool,
    pub conflicted_files: usize,
    pub modified_files: Vec<FileStatusDto>,
    pub latest_commit: Option<CommitInfoDto>,
}

#[derive(Clone, Debug, Serialize)]
pub struct DiffStatDto {
    pub files_changed: usize,
    pub insertions: i32,
    pub deletions: i32,
}

pub fn detect_repo(cwd: &Path) -> Result<Option<PathBuf>, GitError> {
    match run_git(cwd, &["rev-parse", "--show-toplevel"]) {
        Ok(output) => {
            let root = output.stdout.trim();
            if root.is_empty() {
                return Ok(None);
            }
            let root_path = PathBuf::from(root);
            Ok(Some(canonicalize(root_path)))
        }
        Err(GitError::GitFailed { stderr, .. })
            if stderr.to_ascii_lowercase().contains("not a git repository") =>
        {
            Ok(None)
        }
        Err(err) => Err(err),
    }
}

pub fn status(cwd: &Path) -> Result<RepoStatusDto, GitError> {
    let repo_root = ensure_repo(cwd)?;
    let output = run_git(cwd, &["status", "--porcelain=v2", "-b"])?;
    let mut status = parse_status(&output.stdout, &repo_root);
    status.latest_commit = latest_commit(&repo_root)?;
    Ok(status)
}

pub fn diff(cwd: &Path, pathspecs: &[String]) -> Result<String, GitError> {
    let _repo_root = ensure_repo(cwd)?;
    let mut args: Vec<String> = vec!["diff".into(), "--numstat".into()];
    if !pathspecs.is_empty() {
        args.push("--".into());
        args.extend(pathspecs.iter().cloned());
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = run_git(cwd, &arg_refs)?;
    Ok(output.stdout)
}

pub fn diff_stats_against_branch(
    worktree: &Path,
    base_branch: &str,
) -> Result<DiffStatDto, GitError> {
    let _ = ensure_repo(worktree)?;
    let output = run_git(worktree, &["diff", "--numstat", base_branch])?;
    Ok(parse_numstat_summary(&output.stdout))
}

pub fn default_branch(cwd: &Path) -> Result<String, GitError> {
    let repo_root = ensure_repo(cwd)?;

    if let Ok(out) = run_git(&repo_root, &["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
    {
        let remote_head = out.stdout.trim();
        if !remote_head.is_empty() {
            let local = remote_head.strip_prefix("origin/").unwrap_or(remote_head);
            if branch_exists(&repo_root, local)? {
                return Ok(local.to_string());
            }
        }
    }

    for candidate in ["main", "master"] {
        if branch_exists(&repo_root, candidate)? {
            return Ok(candidate.to_string());
        }
    }

    current_branch(&repo_root)
}

pub fn difftool(worktree: &Path, path: Option<&str>) -> Result<(), GitError> {
    let worktree = ensure_repo(worktree)?;
    let mut args: Vec<String> = vec![
        "difftool".to_string(),
        "-y".to_string(),
        "--tool=opendiff".to_string(),
    ];
    if let Some(p) = path {
        args.push("--".to_string());
        args.push(p.to_string());
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_git(&worktree, &arg_refs).map(|_| ())
}

pub fn commit(cwd: &Path, message: &str, stage_all: bool, amend: bool) -> Result<(), GitError> {
    let _repo_root = ensure_repo(cwd)?;
    if stage_all {
        run_git(cwd, &["add", "-A"])?;
    }

    let mut args = vec!["commit".to_string(), "-m".to_string(), message.to_string()];
    if amend {
        args.push("--amend".to_string());
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_git(cwd, &arg_refs)?;
    Ok(())
}

pub fn current_branch(cwd: &Path) -> Result<String, GitError> {
    let repo_root = ensure_repo(cwd)?;
    let output = run_git(&repo_root, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    Ok(output.stdout.trim().to_string())
}

pub fn branch_exists(cwd: &Path, branch: &str) -> Result<bool, GitError> {
    let repo_root = ensure_repo(cwd)?;
    match run_git(&repo_root, &["rev-parse", "--verify", branch]) {
        Ok(_) => Ok(true),
        Err(GitError::GitFailed { .. }) => Ok(false),
        Err(err) => Err(err),
    }
}

pub fn add_worktree(
    repo_root: &Path,
    worktree_path: &Path,
    branch: &str,
    start_point: &str,
) -> Result<(), GitError> {
    let path_str = worktree_path.to_string_lossy();
    run_git(
        repo_root,
        &[
            "worktree",
            "add",
            "-b",
            branch,
            path_str.as_ref(),
            start_point,
        ],
    )?;
    Ok(())
}

pub fn remove_worktree(
    repo_root: &Path,
    worktree_path: &Path,
    force: bool,
) -> Result<(), GitError> {
    let path_str = worktree_path.to_string_lossy().to_string();
    let mut args = vec!["worktree".to_string(), "remove".to_string()];
    if force {
        args.push("--force".to_string());
    }
    args.push(path_str);
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_git(repo_root, &arg_refs)?;
    Ok(())
}

pub fn delete_branch(repo_root: &Path, branch: &str, force: bool) -> Result<(), GitError> {
    let repo_root = ensure_repo(repo_root)?;
    let flag = if force { "-D" } else { "-d" };
    run_git(&repo_root, &["branch", flag, branch])?;
    Ok(())
}

fn ensure_repo(cwd: &Path) -> Result<PathBuf, GitError> {
    detect_repo(cwd)?.ok_or_else(|| GitError::GitFailed {
        code: None,
        stderr: "not a git repository".to_string(),
    })
}

fn canonicalize(path: PathBuf) -> PathBuf {
    fs::canonicalize(&path).unwrap_or(path)
}

pub fn latest_commit(cwd: &Path) -> Result<Option<CommitInfoDto>, GitError> {
    let repo_root = ensure_repo(cwd)?;
    let fmt = "%H\x1f%an\x1f%ar\x1f%s";
    let output = match run_git(
        &repo_root,
        &["log", "-1", &format!("--pretty=format:{fmt}")],
    ) {
        Ok(out) => out,
        Err(GitError::GitFailed { code: _, stderr })
            if stderr
                .to_ascii_lowercase()
                .contains("does not have any commits yet") =>
        {
            return Ok(None);
        }
        Err(err) => return Err(err),
    };

    let line = output.stdout.trim();
    if line.is_empty() {
        return Ok(None);
    }

    let parts: Vec<&str> = line.split('\u{1f}').collect();
    let id = parts.get(0).unwrap_or(&"").to_string();
    let author = parts.get(1).unwrap_or(&"").to_string();
    let relative_time = parts.get(2).unwrap_or(&"").to_string();
    let summary = parts.get(3).unwrap_or(&"").to_string();

    if id.is_empty() && summary.is_empty() {
        return Ok(None);
    }

    Ok(Some(CommitInfoDto {
        id,
        summary,
        author,
        relative_time,
    }))
}

fn map_status_code(code: char) -> Option<FileChangeType> {
    match code {
        'M' | 'T' => Some(FileChangeType::Modified),
        'A' => Some(FileChangeType::Added),
        'D' => Some(FileChangeType::Deleted),
        'R' | 'C' => Some(FileChangeType::Renamed),
        'U' => Some(FileChangeType::Unmerged),
        _ => None,
    }
}

fn parse_status(stdout: &str, repo_root: &Path) -> RepoStatusDto {
    let mut branch = "HEAD".to_string();
    let mut ahead = 0;
    let mut behind = 0;
    let mut has_untracked = false;
    let mut has_staged = false;
    let mut has_unstaged = false;
    let mut conflicted_files = 0usize;
    let mut modified_files: Vec<FileStatusDto> = Vec::new();

    for line in stdout.lines() {
        if let Some(meta) = line.strip_prefix("# ") {
            if let Some(value) = meta.strip_prefix("branch.head ") {
                branch = value.trim().to_string();
            } else if let Some(value) = meta.strip_prefix("branch.ab ") {
                let mut parts = value.split_whitespace();
                ahead = parts.next().map(parse_signed_count).unwrap_or_default();
                behind = parts.next().map(parse_signed_count).unwrap_or_default();
            }
            continue;
        }

        if line.starts_with("1 ") {
            if let Some(file) = parse_regular_line(line) {
                update_flags(
                    &file,
                    &mut has_staged,
                    &mut has_unstaged,
                    &mut conflicted_files,
                );
                modified_files.push(file);
            }
            continue;
        }

        if line.starts_with("2 ") {
            if let Some(file) = parse_rename_line(line) {
                update_flags(
                    &file,
                    &mut has_staged,
                    &mut has_unstaged,
                    &mut conflicted_files,
                );
                modified_files.push(file);
            }
            continue;
        }

        if line.starts_with("u ") {
            if let Some(file) = parse_unmerged_line(line) {
                update_flags(
                    &file,
                    &mut has_staged,
                    &mut has_unstaged,
                    &mut conflicted_files,
                );
                modified_files.push(file);
            }
            continue;
        }

        if let Some(path) = line.strip_prefix("? ") {
            has_untracked = true;
            has_unstaged = true;
            let file = FileStatusDto {
                path: path.to_string(),
                staged: None,
                unstaged: Some(FileChangeType::Added),
            };
            modified_files.push(file);
        }
    }

    let repo_id = canonicalize(repo_root.to_path_buf());
    RepoStatusDto {
        repo_id: repo_id.to_string_lossy().to_string(),
        root_path: repo_id.to_string_lossy().to_string(),
        branch,
        ahead,
        behind,
        has_untracked,
        has_staged,
        has_unstaged,
        conflicted_files,
        modified_files,
        latest_commit: None,
    }
}

fn parse_regular_line(line: &str) -> Option<FileStatusDto> {
    let parts: Vec<&str> = line.splitn(9, ' ').collect();
    if parts.len() < 9 {
        return None;
    }
    let xy = parts.get(1)?.chars().collect::<Vec<_>>();
    if xy.len() < 2 {
        return None;
    }

    let staged = map_status_code(xy[0]);
    let unstaged = map_status_code(xy[1]);
    Some(FileStatusDto {
        path: parts[8].to_string(),
        staged,
        unstaged,
    })
}

fn parse_rename_line(line: &str) -> Option<FileStatusDto> {
    let parts: Vec<&str> = line.splitn(10, ' ').collect();
    if parts.len() < 10 {
        return None;
    }
    let xy = parts.get(1)?.chars().collect::<Vec<_>>();
    if xy.len() < 2 {
        return None;
    }

    let staged = map_status_code(xy[0]);
    let unstaged = map_status_code(xy[1]);
    // For renames we surface the new path.
    Some(FileStatusDto {
        path: parts[8].to_string(),
        staged,
        unstaged,
    })
}

fn parse_unmerged_line(line: &str) -> Option<FileStatusDto> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 3 {
        return None;
    }
    let xy = parts.get(1)?.chars().collect::<Vec<_>>();
    if xy.len() < 2 {
        return None;
    }

    let staged = map_status_code(xy[0]);
    let unstaged = map_status_code(xy[1]);
    let path = parts.last()?.to_string();
    Some(FileStatusDto {
        path,
        staged,
        unstaged,
    })
}

fn update_flags(
    file: &FileStatusDto,
    has_staged: &mut bool,
    has_unstaged: &mut bool,
    conflicted_files: &mut usize,
) {
    if matches!(file.staged, Some(FileChangeType::Unmerged))
        || matches!(file.unstaged, Some(FileChangeType::Unmerged))
    {
        *conflicted_files += 1;
    }

    if file.staged.is_some() {
        *has_staged = true;
    }
    if file.unstaged.is_some() {
        *has_unstaged = true;
    }
}

fn parse_signed_count(raw: &str) -> i32 {
    let trimmed = raw.trim_start_matches('+').trim_start_matches('-');
    trimmed.parse::<i32>().unwrap_or(0)
}

fn parse_numstat_summary(stdout: &str) -> DiffStatDto {
    let mut files_changed = 0usize;
    let mut insertions = 0i32;
    let mut deletions = 0i32;

    for line in stdout.lines() {
        let mut parts = line.split_whitespace();
        let added = parts.next().unwrap_or_default();
        let removed = parts.next().unwrap_or_default();
        let file_path = parts.next().unwrap_or_default();
        if file_path.is_empty() {
            continue;
        }

        files_changed += 1;
        if added != "-" {
            insertions += added.parse::<i32>().unwrap_or(0);
        }
        if removed != "-" {
            deletions += removed.parse::<i32>().unwrap_or(0);
        }
    }

    DiffStatDto {
        files_changed,
        insertions,
        deletions,
    }
}
