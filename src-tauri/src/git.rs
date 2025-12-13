use serde::Serialize;
use std::{
    collections::HashSet,
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

#[derive(Clone, Debug, Serialize)]
pub struct BranchInfoDto {
    pub name: String,
    pub current: bool,
}

pub fn detect_repo(cwd: &Path) -> Result<Option<PathBuf>, GitError> {
    match run_git(cwd, &["rev-parse", "--show-toplevel"]) {
        Ok(output) => {
            let root = output.stdout.trim();
            if root.is_empty() {
                return Ok(None);
            }
            let root_path = PathBuf::from(root);
            Ok(Some(canonicalize_path(&root_path)))
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
    let output = run_git(cwd, &["status", "--porcelain=v2", "-z", "-b"])?;
    let mut status = parse_status_z(&output.stdout, &repo_root);
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

pub fn diff_stats_worktree(worktree: &Path) -> Result<DiffStatDto, GitError> {
    let worktree = ensure_repo(worktree)?;
    let mut combined = String::new();
    let mut errors: Vec<GitError> = Vec::new();
    let mut untracked_files: Vec<String> = Vec::new();
    let mut untracked_insertions = 0i32;

    match run_git(&worktree, &["diff", "--numstat"]) {
        Ok(out) => {
            combined.push_str(&out.stdout);
        }
        Err(err) => errors.push(err),
    }

    match run_git(&worktree, &["diff", "--numstat", "--cached"]) {
        Ok(out) => {
            if !combined.is_empty() && !out.stdout.is_empty() {
                combined.push('\n');
            }
            combined.push_str(&out.stdout);
        }
        Err(err) => errors.push(err),
    }

    if let Ok(out) = run_git(&worktree, &["ls-files", "--others", "--exclude-standard"]) {
        for line in out.stdout.lines() {
            let path = line.trim();
            if path.is_empty() {
                continue;
            }
            untracked_files.push(path.to_string());
            let full_path = worktree.join(path);
            if let Ok(contents) = fs::read_to_string(&full_path) {
                // Count lines in a simple, cross-platform way.
                let count = if contents.is_empty() {
                    0
                } else {
                    contents.lines().count()
                };
                untracked_insertions += count as i32;
            }
        }
    }

    if combined.trim().is_empty() {
        if let Some(err) = errors.into_iter().next() {
            return Err(err);
        }
        if !untracked_files.is_empty() {
            return Ok(DiffStatDto {
                files_changed: untracked_files.len(),
                insertions: untracked_insertions,
                deletions: 0,
            });
        }
        return Ok(DiffStatDto {
            files_changed: 0,
            insertions: 0,
            deletions: 0,
        });
    }

    let mut summary = parse_numstat_summary(&combined);
    if !untracked_files.is_empty() {
        summary.files_changed += untracked_files.len();
        summary.insertions += untracked_insertions;
    }
    Ok(summary)
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

pub fn list_branches(cwd: &Path) -> Result<Vec<BranchInfoDto>, GitError> {
    let repo_root = ensure_repo(cwd)?;
    let output = run_git(&repo_root, &["branch", "--list"])?;
    let mut branches = Vec::new();
    for line in output.stdout.lines() {
        let trimmed = line.trim_start();
        if trimmed.is_empty() {
            continue;
        }
        let current = trimmed.starts_with('*');
        let name = trimmed.trim_start_matches('*').trim().to_string();
        if !name.is_empty() {
            branches.push(BranchInfoDto { name, current });
        }
    }
    Ok(branches)
}

pub fn difftool(worktree: &Path, path: Option<&str>) -> Result<(), GitError> {
    let worktree = ensure_repo(worktree)?;
    let tool = resolve_difftool_tool();

    // If a specific path is requested, run difftool for that path.
    if let Some(p) = path {
        let mut args: Vec<String> = vec!["difftool".to_string(), "-y".to_string()];
        if let Some(tool) = &tool {
            args.push(format!("--tool={tool}"));
        }
        args.push("--".to_string());
        args.push(p.to_string());
        let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
        return run_git(&worktree, &arg_refs).map(|_| ());
    }

    // Otherwise, only launch difftool when there is something to diff.
    let tracked = run_git(&worktree, &["diff", "--name-only"])
        .map(|o| o.stdout)
        .unwrap_or_default();
    let tracked_cached = run_git(&worktree, &["diff", "--name-only", "--cached"])
        .map(|o| o.stdout)
        .unwrap_or_default();

    if !tracked.trim().is_empty() || !tracked_cached.trim().is_empty() {
        let mut args: Vec<String> = vec!["difftool".to_string(), "-y".to_string()];
        if let Some(tool) = &tool {
            args.push(format!("--tool={tool}"));
        }
        let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
        return run_git(&worktree, &arg_refs).map(|_| ());
    }

    // Fall back to showing untracked file(s) against /dev/null.
    if let Ok(out) = run_git(&worktree, &["ls-files", "--others", "--exclude-standard"]) {
        if let Some(first) = out.stdout.lines().find(|l| !l.trim().is_empty()) {
            let null_path = if cfg!(windows) { "NUL" } else { "/dev/null" };
            let mut args: Vec<String> = vec![
                "difftool".to_string(),
                "-y".to_string(),
            ];
            if let Some(tool) = &tool {
                args.push(format!("--tool={tool}"));
            }
            args.push("--no-index".to_string());
            args.push(null_path.to_string());
            args.push(first.trim().to_string());
            let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
            return run_git(&worktree, &arg_refs).map(|_| ());
        }
    }

    Ok(())
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

pub fn merge_into_branch(
    repo_root: &Path,
    target_branch: &str,
    source_branch: &str,
) -> Result<(), GitError> {
    let repo_root = ensure_repo(repo_root)?;

    if target_branch.trim().is_empty() || source_branch.trim().is_empty() {
        return Err(GitError::GitFailed {
            code: None,
            stderr: "targetBranch and sourceBranch are required".to_string(),
        });
    }

    // Ensure both refs exist up-front for clearer errors.
    run_git(&repo_root, &["rev-parse", "--verify", target_branch])?;
    run_git(&repo_root, &["rev-parse", "--verify", source_branch])?;

    let original_branch = current_branch(&repo_root)?;
    let switched = original_branch != target_branch;
    if switched {
        // NOTE: This will fail if the branch is checked out in another worktree.
        run_git(&repo_root, &["switch", target_branch])?;
    }

    // If the target worktree is dirty, stash it before merging, then restore after.
    let mut created_stash = false;
    match run_git(&repo_root, &["status", "--porcelain"]) {
        Ok(status) if !status.stdout.trim().is_empty() => {
            let msg = "parallel-cli-runner: auto-stash before merge";
            run_git(&repo_root, &["stash", "push", "-u", "-m", msg])?;
            created_stash = true;
        }
        Ok(_) => {}
        Err(err) => return Err(err),
    }

    match run_git(&repo_root, &["merge", "--no-edit", source_branch]) {
        Ok(_) => {
            if created_stash {
                // Re-apply stashed local changes onto the target branch.
                if let Err(err) = run_git(&repo_root, &["stash", "pop"]) {
                    // Don't try to switch branches if the worktree is now conflicted.
                    return Err(GitError::GitFailed {
                        code: None,
                        stderr: format!(
                            "merge succeeded, but failed to re-apply stashed changes; resolve manually (git stash list / git stash pop): {err}"
                        ),
                    });
                }
            }
            if switched {
                // Best-effort: don't fail the whole operation just because restoring fails.
                let _ = run_git(&repo_root, &["switch", &original_branch]);
            }
            Ok(())
        }
        Err(err) => {
            // If the merge failed (e.g., conflicts), don't attempt to pop the stash.
            // Keep it so the user can restore once the merge is resolved/aborted.
            Err(err)
        }
    }
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

pub fn canonicalize_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
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

fn parse_status_z(stdout: &str, repo_root: &Path) -> RepoStatusDto {
    let mut branch = "HEAD".to_string();
    let mut ahead = 0;
    let mut behind = 0;
    let mut has_untracked = false;
    let mut has_staged = false;
    let mut has_unstaged = false;
    let mut conflicted_files = 0usize;
    let mut modified_files: Vec<FileStatusDto> = Vec::new();

    let tokens: Vec<&str> = stdout.split('\0').collect();
    let mut i = 0usize;

    while i < tokens.len() {
        let record = tokens[i];
        if record.is_empty() {
            i += 1;
            continue;
        }

        if let Some(meta) = record.strip_prefix("# ") {
            if let Some(value) = meta.strip_prefix("branch.head ") {
                branch = value.trim().to_string();
            } else if let Some(value) = meta.strip_prefix("branch.ab ") {
                let mut parts = value.split_whitespace();
                ahead = parts.next().map(parse_signed_count).unwrap_or_default();
                behind = parts.next().map(parse_signed_count).unwrap_or_default();
            }
            i += 1;
            continue;
        }

        if record.starts_with("1 ") {
            if let Some(file) = parse_record_file(record) {
                update_flags(
                    &file,
                    &mut has_staged,
                    &mut has_unstaged,
                    &mut conflicted_files,
                );
                modified_files.push(file);
            }
            i += 1;
            continue;
        }

        if record.starts_with("2 ") {
            if let Some(file) = parse_record_file(record) {
                update_flags(
                    &file,
                    &mut has_staged,
                    &mut has_unstaged,
                    &mut conflicted_files,
                );
                modified_files.push(file);
            }
            // porcelain v2 -z provides old path as next NUL token
            i += 2;
            continue;
        }

        if record.starts_with("u ") {
            if let Some(file) = parse_record_file(record) {
                update_flags(
                    &file,
                    &mut has_staged,
                    &mut has_unstaged,
                    &mut conflicted_files,
                );
                modified_files.push(file);
            }
            i += 1;
            continue;
        }

        if let Some(path) = record.strip_prefix("? ") {
            let path = path.trim();
            if !path.is_empty() {
                has_untracked = true;
                has_unstaged = true;
                let file = FileStatusDto {
                    path: path.to_string(),
                    staged: None,
                    unstaged: Some(FileChangeType::Added),
                };
                modified_files.push(file);
            }
            i += 1;
            continue;
        }

        i += 1;
    }

    let repo_id = canonicalize_path(repo_root);
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

fn parse_record_file(record: &str) -> Option<FileStatusDto> {
    // With `git status --porcelain=v2 -z`, records are NUL-delimited but paths are
    // unquoted "as-is" and may contain spaces. Use splitn() with the exact field
    // count so the final field preserves spaces in the path.
    let kind = record.chars().next()?;

    let (xy, path) = match kind {
        '1' => {
            // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
            let parts: Vec<&str> = record.splitn(9, ' ').collect();
            if parts.len() < 9 {
                return None;
            }
            (parts[1], parts[8])
        }
        '2' => {
            // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path>
            // With -z, <origPath> is in the next NUL token and is handled by the caller.
            let parts: Vec<&str> = record.splitn(10, ' ').collect();
            if parts.len() < 10 {
                return None;
            }
            (parts[1], parts[9])
        }
        'u' => {
            // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
            let parts: Vec<&str> = record.splitn(11, ' ').collect();
            if parts.len() < 11 {
                return None;
            }
            (parts[1], parts[10])
        }
        _ => return None,
    };

    let xy_chars = xy.chars().collect::<Vec<_>>();
    if xy_chars.len() < 2 {
        return None;
    }

    let path = path.trim();
    if path.is_empty() {
        return None;
    }

    let staged = map_status_code(xy_chars[0]);
    let unstaged = map_status_code(xy_chars[1]);

    Some(FileStatusDto {
        path: path.to_string(),
        staged,
        unstaged,
    })
}

fn resolve_difftool_tool() -> Option<String> {
    if let Ok(tool) = std::env::var("PARALLEL_DIFFTOOL") {
        let trimmed = tool.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    if cfg!(target_os = "macos") {
        Some("opendiff".to_string())
    } else {
        None
    }
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
    let mut seen: HashSet<String> = HashSet::new();

    for line in stdout.lines() {
        let mut parts = line.split_whitespace();
        let added = parts.next().unwrap_or_default();
        let removed = parts.next().unwrap_or_default();
        let file_path = parts.next().unwrap_or_default();
        if file_path.is_empty() {
            continue;
        }

        if seen.insert(file_path.to_string()) {
            files_changed += 1;
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn parse_numstat_summary_counts_unique_files_but_sums_changes() {
        let out = [
            "1\t0\tfile-a.txt",
            "2\t1\tfile-b.txt",
            // Same file repeated (e.g. staged + unstaged diffs combined)
            "3\t4\tfile-a.txt",
            // Binary change uses '-' which should be ignored for counts
            "-\t-\tbin.dat",
        ]
        .join("\n");

        let summary = parse_numstat_summary(&out);
        assert_eq!(summary.files_changed, 3); // file-a, file-b, bin.dat
        assert_eq!(summary.insertions, 1 + 2 + 3);
        assert_eq!(summary.deletions, 0 + 1 + 4);
    }

    #[test]
    fn parse_status_z_handles_spaces_and_rename_separator() {
        let status = concat!(
            "# branch.head main\0",
            "# branch.ab +2 -1\0",
            "1 M. N... 100644 100644 100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb src/with space.txt\0",
            "2 R. N... 100644 100644 100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb R100 renamed to.txt\0",
            "renamed from.txt\0",
            "? untracked file.txt\0",
            "u UU N... 100644 100644 100644 100644 cccccccccccccccccccccccccccccccccccccccc dddddddddddddddddddddddddddddddddddddddd eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee conflicted file.txt\0"
        );

        let repo_root = Path::new("fake-repo-root");
        let parsed = parse_status_z(status, repo_root);

        assert_eq!(parsed.branch, "main");
        assert_eq!(parsed.ahead, 2);
        assert_eq!(parsed.behind, 1);
        assert!(parsed.has_staged);
        assert!(parsed.has_unstaged);
        assert!(parsed.has_untracked);
        assert_eq!(parsed.conflicted_files, 1);

        let paths: Vec<&str> = parsed.modified_files.iter().map(|f| f.path.as_str()).collect();
        assert!(paths.contains(&"src/with space.txt"));
        assert!(paths.contains(&"renamed to.txt"));
        assert!(paths.contains(&"untracked file.txt"));
        assert!(paths.contains(&"conflicted file.txt"));

        let renamed = parsed
            .modified_files
            .iter()
            .find(|f| f.path == "renamed to.txt")
            .expect("rename record missing");
        assert!(matches!(renamed.staged, Some(FileChangeType::Renamed)));
        assert!(renamed.unstaged.is_none());

        let conflicted = parsed
            .modified_files
            .iter()
            .find(|f| f.path == "conflicted file.txt")
            .expect("conflict record missing");
        assert!(matches!(conflicted.staged, Some(FileChangeType::Unmerged)));
        assert!(matches!(conflicted.unstaged, Some(FileChangeType::Unmerged)));
    }
}
