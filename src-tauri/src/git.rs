use git2::{
    build::CheckoutBuilder, BranchType, Delta, Diff, DiffFindOptions, DiffFormat, DiffOptions,
    DiffStatsFormat, ErrorCode, IndexAddOption, MergeOptions, Repository, ResetType, RevertOptions,
    StashFlags, Status, StatusOptions, StatusShow, WorktreeAddOptions, WorktreePruneOptions,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    io::BufRead,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use thiserror::Error;
use ts_rs::TS;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("git not found")]
    GitNotFound,
    #[error("git failed: {stderr}")]
    GitFailed { code: Option<i32>, stderr: String },
    #[error("git2 error: {0}")]
    Git2(#[from] git2::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("utf8 error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
}

#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum FileChangeType {
    Added,
    Modified,
    Deleted,
    Renamed,
    Unmerged,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct FileStats {
    pub insertions: i32,
    pub deletions: i32,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct FileStatusDto {
    pub path: String,
    pub staged: Option<FileChangeType>,
    pub unstaged: Option<FileChangeType>,
    pub staged_stats: Option<FileStats>,
    pub unstaged_stats: Option<FileStats>,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct CommitInfoDto {
    pub id: String,
    pub summary: String,
    pub author: String,
    pub relative_time: String,
}

#[derive(Clone, Debug, Serialize, TS)]
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

#[derive(Clone, Debug, Serialize, TS)]
pub struct RepoInfoDto {
    pub repo_id: String,
    pub root_path: String,
    pub name: String,
    pub is_bare: bool,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct DiffStatDto {
    pub files_changed: usize,
    pub insertions: i32,
    pub deletions: i32,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct BranchInfoDto {
    pub name: String,
    pub current: bool,
    pub last_commit: String,
    pub ahead: i32,
    pub behind: i32,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct RemoteInfoDto {
    pub name: String,
    pub fetch: String,
    pub push: String,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct WorktreeInfoDto {
    pub branch: String,
    pub path: String,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct StashInfoDto {
    pub index: i32,
    pub message: String,
    pub id: String,
    pub relative_time: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DiffCompareKind {
    WorktreeHead,
    RefRef,
    IndexHead,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
pub struct DiffRequestOptionsDto {
    pub context_lines: Option<u32>,
    pub show_binary: Option<bool>,
    pub include_untracked: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
pub struct DiffRequestDto {
    pub repo_path: String,
    pub compare_kind: DiffCompareKind,
    pub left: Option<String>,
    pub right: Option<String>,
    pub paths: Option<Vec<String>>,
    pub options: Option<DiffRequestOptionsDto>,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct DiffFileSummaryDto {
    pub path: String,
    pub status: DiffDeltaStatus,
    pub is_binary: bool,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct DiffMetaDto {
    pub compare_kind: DiffCompareKind,
    pub left: Option<String>,
    pub right: Option<String>,
    pub paths: Vec<String>,
    pub context_lines: u32,
    pub file_summaries: Vec<DiffFileSummaryDto>,
    pub conflicted_paths: Vec<String>,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct DiffResponseDto {
    pub diff_text: String,
    pub diff_hash: String,
    pub meta: DiffMetaDto,
}

#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum DiffDeltaStatus {
    Unmodified,
    Added,
    Deleted,
    Modified,
    Renamed,
    Copied,
    Ignored,
    Untracked,
    Typechange,
    Unreadable,
    Conflicted,
}

pub fn detect_repo(cwd: &Path) -> Result<Option<PathBuf>, GitError> {
    match Repository::discover(cwd) {
        Ok(repo) => Ok(Some(repo_root_path(&repo))),
        Err(err) if err.code() == ErrorCode::NotFound => Ok(None),
        Err(err) => Err(GitError::Git2(err)),
    }
}

pub fn status(cwd: &Path) -> Result<RepoStatusDto, GitError> {
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

pub fn scan_repos<F>(root: &Path, progress_cb: F) -> Result<Vec<RepoInfoDto>, GitError>
where
    F: Fn(String),
{
    let mut seen = HashSet::new();
    let mut scanned_entries = Vec::new();

    if let Ok(repo) = Repository::discover(root) {
        let info = repo_info_from_repo(&repo);
        let git_path = canonicalize_path(repo.path());
        if seen.insert(info.root_path.clone()) {
            scanned_entries.push((info, git_path));
        }
    }

    let mut pending = vec![root.to_path_buf()];
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
                let info = repo_info_from_repo(&repo);
                let git_path = canonicalize_path(repo.path());
                if seen.insert(info.root_path.clone()) {
                    scanned_entries.push((info, git_path));
                }
                is_repo_dir = true;
            }
        } else {
            let head = dir.join("HEAD");
            let objects = dir.join("objects");
            if head.is_file() && objects.is_dir() {
                if let Ok(repo) = Repository::open(&dir) {
                    let info = repo_info_from_repo(&repo);
                    let git_path = canonicalize_path(repo.path());
                    if seen.insert(info.root_path.clone()) {
                        scanned_entries.push((info, git_path));
                    }
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

            pending.push(path);
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

pub fn diff(cwd: &Path, pathspecs: &[String]) -> Result<String, GitError> {
    let repo = open_repo(cwd)?;
    let mut opts = DiffOptions::new();
    for pathspec in pathspecs {
        opts.pathspec(pathspec);
    }
    let diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;
    let stats = diff.stats()?;
    let buf = stats.to_buf(DiffStatsFormat::NUMBER, 80)?;
    Ok(buf.as_str().unwrap_or_default().to_string())
}

pub fn get_unified_diff(req: DiffRequestDto) -> Result<DiffResponseDto, GitError> {
    let repo = open_repo(Path::new(&req.repo_path))?;
    let paths = req.paths.clone().unwrap_or_default();
    let (mut opts, context_lines, include_untracked) = build_diff_options(&paths, req.options.as_ref());
    let compare_kind = req.compare_kind.clone();

    let diff = match compare_kind {
        DiffCompareKind::WorktreeHead => {
            let head_tree = match repo.head() {
                Ok(head) => Some(head.peel_to_tree()?),
                Err(err) if err.code() == ErrorCode::UnbornBranch => None,
                Err(err) => return Err(GitError::Git2(err)),
            };
            if include_untracked {
                opts.include_untracked(true).recurse_untracked_dirs(true);
            }
            repo.diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))?
        }
        DiffCompareKind::RefRef => {
            let left = req
                .left
                .as_deref()
                .ok_or_else(|| GitError::Git2(git2::Error::from_str("missing left ref")))?;
            let right = req
                .right
                .as_deref()
                .ok_or_else(|| GitError::Git2(git2::Error::from_str("missing right ref")))?;
            let left_tree = repo.revparse_single(left)?.peel_to_tree()?;
            let right_tree = repo.revparse_single(right)?.peel_to_tree()?;
            repo.diff_tree_to_tree(Some(&left_tree), Some(&right_tree), Some(&mut opts))?
        }
        DiffCompareKind::IndexHead => {
            let head_tree = match repo.head() {
                Ok(head) => Some(head.peel_to_tree()?),
                Err(err) if err.code() == ErrorCode::UnbornBranch => None,
                Err(err) => return Err(GitError::Git2(err)),
            };
            let index = repo.index()?;
            repo.diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut opts))?
        }
    };

    let mut diff = diff;
    let mut find_opts = DiffFindOptions::new();
    diff.find_similar(Some(&mut find_opts))?;

    let diff_text = diff_to_unified_string(&diff)?;
    let diff_hash = hash_bytes(diff_text.as_bytes());
    let file_summaries = diff_file_summaries(&diff)?;
    let conflicted_paths = match compare_kind {
        DiffCompareKind::WorktreeHead | DiffCompareKind::IndexHead => {
            index_conflicted_paths(&repo)?
        }
        DiffCompareKind::RefRef => Vec::new(),
    };

    Ok(DiffResponseDto {
        diff_text,
        diff_hash,
        meta: DiffMetaDto {
            compare_kind,
            left: req.left,
            right: req.right,
            paths,
            context_lines,
            file_summaries,
            conflicted_paths,
        },
    })
}

fn build_diff_options(
    paths: &[String],
    options: Option<&DiffRequestOptionsDto>,
) -> (DiffOptions, u32, bool) {
    let mut opts = DiffOptions::new();
    let context_lines = options.and_then(|opts| opts.context_lines).unwrap_or(3);
    let show_binary = options.and_then(|opts| opts.show_binary).unwrap_or(true);
    let include_untracked = options
        .and_then(|opts| opts.include_untracked)
        .unwrap_or(true);

    opts.context_lines(context_lines);
    opts.show_binary(show_binary);
    for path in paths {
        opts.pathspec(path);
    }

    (opts, context_lines, include_untracked)
}

fn diff_to_unified_string(diff: &Diff<'_>) -> Result<String, GitError> {
    let mut buf = Vec::new();
    diff.print(DiffFormat::Patch, |_delta, _hunk, line| {
        buf.extend_from_slice(line.content());
        true
    })?;
    Ok(String::from_utf8(buf)?)
}

fn diff_file_summaries(diff: &Diff<'_>) -> Result<Vec<DiffFileSummaryDto>, GitError> {
    let mut summaries = Vec::new();
    for delta in diff.deltas() {
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string());
        let Some(path) = path else { continue };
        summaries.push(DiffFileSummaryDto {
            path,
            status: map_delta_status(delta.status()),
            is_binary: delta.new_file().is_binary() || delta.old_file().is_binary(),
        });
    }
    Ok(summaries)
}

fn map_delta_status(status: Delta) -> DiffDeltaStatus {
    match status {
        Delta::Unmodified => DiffDeltaStatus::Unmodified,
        Delta::Added => DiffDeltaStatus::Added,
        Delta::Deleted => DiffDeltaStatus::Deleted,
        Delta::Modified => DiffDeltaStatus::Modified,
        Delta::Renamed => DiffDeltaStatus::Renamed,
        Delta::Copied => DiffDeltaStatus::Copied,
        Delta::Ignored => DiffDeltaStatus::Ignored,
        Delta::Untracked => DiffDeltaStatus::Untracked,
        Delta::Typechange => DiffDeltaStatus::Typechange,
        Delta::Unreadable => DiffDeltaStatus::Unreadable,
        Delta::Conflicted => DiffDeltaStatus::Conflicted,
    }
}

fn index_conflicted_paths(repo: &Repository) -> Result<Vec<String>, GitError> {
    let index = repo.index()?;
    let mut paths = HashSet::new();
    let mut conflicts = match index.conflicts() {
        Ok(conflicts) => conflicts,
        Err(err) if err.code() == ErrorCode::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(GitError::Git2(err)),
    };

    while let Some(conflict) = conflicts.next() {
        let conflict = conflict?;
        let path = conflict
            .our
            .as_ref()
            .or(conflict.their.as_ref())
            .or(conflict.ancestor.as_ref())
            .map(|entry| String::from_utf8(entry.path.clone()))
            .transpose()?;
        if let Some(path) = path {
            paths.insert(path);
        }
    }

    let mut sorted: Vec<String> = paths.into_iter().collect();
    sorted.sort();
    Ok(sorted)
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

pub fn diff_stats_against_branch(
    worktree: &Path,
    base_branch: &str,
) -> Result<DiffStatDto, GitError> {
    let repo = open_repo(worktree)?;
    let obj = repo.revparse_single(base_branch)?;
    let tree = obj.peel_to_tree()?;
    let mut opts = DiffOptions::new();
    let diff = repo.diff_tree_to_workdir_with_index(Some(&tree), Some(&mut opts))?;
    diff_stats_from_diff(&diff)
}

pub fn diff_stats_worktree(worktree: &Path) -> Result<DiffStatDto, GitError> {
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

pub fn list_remotes(cwd: &Path) -> Result<Vec<RemoteInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let mut remotes = Vec::new();
    let names = repo.remotes()?;
    for name in names.iter().flatten() {
        let remote = repo.find_remote(name)?;
        let fetch = remote.url().unwrap_or_default().to_string();
        let push = remote.pushurl().unwrap_or(fetch.as_str()).to_string();
        remotes.push(RemoteInfoDto {
            name: name.to_string(),
            fetch,
            push,
        });
    }
    Ok(remotes)
}

pub fn list_worktrees(cwd: &Path) -> Result<Vec<WorktreeInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let mut worktrees = Vec::new();

    if let Some(workdir) = repo.workdir() {
        let branch = current_branch_from_repo(&repo)?;
        worktrees.push(WorktreeInfoDto {
            branch,
            path: canonicalize_path(workdir).to_string_lossy().to_string(),
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

            let mut opts = WorktreePruneOptions::new();
            opts.valid(true);
            if worktree.prune(Some(&mut opts)).is_ok() {
                if let Some(branch_name) = branch_to_delete {
                    if let Ok(mut branch) = repo.find_branch(&branch_name, BranchType::Local) {
                        let _ = branch.delete();
                    }
                }
            }
            continue;
        }

        let branch = match Repository::open(path) {
            Ok(worktree_repo) => current_branch_from_repo(&worktree_repo).unwrap_or_else(|_| "HEAD".to_string()),
            Err(_) => "HEAD".to_string(),
        };
        worktrees.push(WorktreeInfoDto {
            branch,
            path: canonicalize_path(path).to_string_lossy().to_string(),
        });
    }

    Ok(worktrees)
}

pub fn list_commits(cwd: &Path, limit: usize, skip: Option<usize>) -> Result<Vec<CommitInfoDto>, GitError> {
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

pub fn list_stashes(cwd: &Path) -> Result<Vec<StashInfoDto>, GitError> {
    let mut repo = open_repo(cwd)?;
    let mut stashes = Vec::new();
    let mut stashes_raw: Vec<(i32, String, git2::Oid)> = Vec::new();

    repo.stash_foreach(|index, message, oid| {
        stashes_raw.push((index as i32, message.to_string(), *oid));
        true
    })?;

    for (index, message, oid) in stashes_raw {
        let relative_time = repo
            .find_commit(oid)
            .map(|commit| format_relative_time(commit.time()))
            .unwrap_or_default();
        stashes.push(StashInfoDto {
            index,
            message,
            id: oid.to_string(),
            relative_time,
        });
    }

    Ok(stashes)
}

pub fn commit(cwd: &Path, message: &str, stage_all: bool, amend: bool) -> Result<(), GitError> {
    let repo = open_repo(cwd)?;
    let mut index = repo.index()?;

    if stage_all {
        index.add_all(["."].iter(), IndexAddOption::DEFAULT, None)?;
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

pub fn stage_paths(cwd: &Path, paths: &[String]) -> Result<(), GitError> {
    if paths.is_empty() {
        return Ok(());
    }
    let repo = open_repo(cwd)?;
    let mut index = repo.index()?;
    for path in paths {
        index.add_path(Path::new(path))?;
    }
    index.write()?;
    Ok(())
}

pub fn unstage_paths(cwd: &Path, paths: &[String]) -> Result<(), GitError> {
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

pub fn stage_all(cwd: &Path) -> Result<(), GitError> {
    let repo = open_repo(cwd)?;
    let mut index = repo.index()?;
    index.add_all(["."].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

pub fn unstage_all(cwd: &Path) -> Result<(), GitError> {
    let staged_paths = staged_paths(cwd)?;
    unstage_paths(cwd, &staged_paths)
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
        let mut checkout_opts = CheckoutBuilder::new();
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
        let mut checkout = CheckoutBuilder::new();
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
    let mut opts = WorktreeAddOptions::new();
    let reference = branch_ref.into_reference();
    opts.reference(Some(&reference));
    repo.worktree(worktree_name, &full_path, Some(&opts))?;
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
            let mut opts = WorktreePruneOptions::new();
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

pub fn checkout_local_branch(repo_root: &Path, branch_name: &str) -> Result<(), GitError> {
    let repo = open_repo(repo_root)?;
    let refname = local_branch_refname(branch_name);
    checkout_branch(&repo, &refname)
}

pub fn smart_checkout_branch(repo_root: &Path, branch_name: &str) -> Result<(), GitError> {
    let mut repo = open_repo(repo_root)?;
    let refname = local_branch_refname(branch_name);

    // 1. Stash changes
    let mut created_stash = false;
    if is_repo_dirty(&repo)? {
        let msg = format!("parallel-cli-runner: auto-stash before switching to {}", branch_name);
        let sig = repo.signature()?;
        // Include untracked files to be safe, though user only mentioned uncommitted (modified)
        repo.stash_save(&sig, &msg, Some(StashFlags::INCLUDE_UNTRACKED))?;
        created_stash = true;
    }

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
         if let Err(err) = repo.stash_pop(0, None) {
            return Err(GitError::GitFailed {
                code: None,
                stderr: format!("Switch successful, but failed to restore stashed changes: {}", err),
            });
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
    let mut checkout = CheckoutBuilder::new();
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

fn open_repo(cwd: &Path) -> Result<Repository, GitError> {
    match Repository::discover(cwd) {
        Ok(repo) => Ok(repo),
        Err(err) if err.code() == ErrorCode::NotFound => Err(GitError::GitFailed {
            code: None,
            stderr: "not a git repository".to_string(),
        }),
        Err(err) => Err(GitError::Git2(err)),
    }
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

pub fn latest_commit(cwd: &Path) -> Result<Option<CommitInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    latest_commit_for_repo(&repo)
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
        if let Ok(branch_ref) = repo.find_branch(&branch, BranchType::Local) {
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

fn branch_exists_in_repo(repo: &Repository, branch: &str) -> Result<bool, GitError> {
    match repo.find_branch(branch, BranchType::Local) {
        Ok(_) => Ok(true),
        Err(err) if err.code() == ErrorCode::NotFound => Ok(false),
        Err(err) => Err(GitError::Git2(err)),
    }
}

fn current_branch_from_repo(repo: &Repository) -> Result<String, GitError> {
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

fn diff_stats_from_diff(diff: &Diff<'_>) -> Result<DiffStatDto, GitError> {
    let stats = diff.stats()?;
    Ok(DiffStatDto {
        files_changed: stats.files_changed(),
        insertions: stats.insertions() as i32,
        deletions: stats.deletions() as i32,
    })
}

fn is_missing_ref_error(err: &git2::Error) -> bool {
    err.code() == ErrorCode::NotFound || err.message().contains("reference")
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

fn checkout_branch(repo: &Repository, refname: &str) -> Result<(), GitError> {
    repo.set_head(refname)?;
    let mut checkout = CheckoutBuilder::new();
    checkout.force();
    repo.checkout_head(Some(&mut checkout))?;
    Ok(())
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

fn staged_paths(cwd: &Path) -> Result<Vec<String>, GitError> {
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

fn branch_last_commit(branch: &git2::Branch<'_>) -> Result<String, GitError> {
    let commit = branch.get().peel_to_commit()?;
    Ok(commit.summary().unwrap_or_default().to_string())
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
        if let Ok(contents) = fs::read_to_string(&full_path) {
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
                    if let Ok(file) = fs::File::open(workdir.join(path)) {
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

fn get_branch_ahead_behind(repo: &Repository, branch: &git2::Branch) -> Result<(usize, usize), GitError> {
    if let Ok(upstream) = branch.upstream() {
        if let (Some(local_oid), Some(upstream_oid)) = (branch.get().target(), upstream.get().target()) {
            let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
            return Ok((ahead, behind));
        }
    }
    Ok((0, 0))
}

#[cfg(target_os = "macos")]
fn get_proxy_url() -> Option<(String, String)> {
    if let Ok(output) = Command::new("scutil").arg("--proxy").output() {
        let s = String::from_utf8_lossy(&output.stdout);
        
        let mut http_enabled = false;
        let mut http_host = String::new();
        let mut http_port = String::new();
        
        let mut socks_enabled = false;
        let mut socks_host = String::new();
        let mut socks_port = String::new();
        
        let bypass = String::new();

        for line in s.lines() {
            let line = line.trim();
            if let Some((key, value)) = line.split_once(':') {
                let key = key.trim();
                let value = value.trim();
                match key {
                    "HTTPEnable" => if value == "1" { http_enabled = true; },
                    "HTTPProxy" => http_host = value.to_string(),
                    "HTTPPort" => http_port = value.to_string(),
                    "SOCKSEnable" => if value == "1" { socks_enabled = true; },
                    "SOCKSProxy" => socks_host = value.to_string(),
                    "SOCKSPort" => socks_port = value.to_string(),
                    "ExceptionsList" => {
                        // scutil output for list is complex, usually spans lines.
                        // For simplicity, we might skip parsing complex bypass list from scutil
                        // and rely on sysproxy if needed, or just ignore for now as the issue is CONNECT.
                    }, 
                    _ => {}
                }
            }
        }
        
        // Prefer HTTP
        if http_enabled && !http_host.is_empty() && !http_port.is_empty() {
            return Some((format!("http://{}:{}", http_host, http_port), bypass));
        }
        if socks_enabled && !socks_host.is_empty() && !socks_port.is_empty() {
            return Some((format!("socks5://{}:{}", socks_host, socks_port), bypass));
        }
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn get_proxy_url() -> Option<(String, String)> {
    if let Ok(proxy) = sysproxy::Sysproxy::get_system_proxy() {
        if proxy.enable {
            let host = proxy.host;
            let port = proxy.port;
            let url = if host.contains("://") {
                format!("{}:{}", host, port)
            } else {
                format!("http://{}:{}", host, port)
            };
            return Some((url, proxy.bypass));
        }
    }
    None
}

fn configure_proxy(cmd: &mut Command) -> Option<String> {
    let detected_proxy = get_proxy_url();
    if let Some((proxy_url, bypass)) = &detected_proxy {
        cmd.env("http_proxy", proxy_url);
        cmd.env("https_proxy", proxy_url);
        cmd.env("HTTP_PROXY", proxy_url);
        cmd.env("HTTPS_PROXY", proxy_url);

        if !bypass.is_empty() {
            cmd.env("no_proxy", bypass);
            cmd.env("NO_PROXY", bypass);
        }
        return Some(proxy_url.clone());
    }
    None
}

pub fn pull(cwd: &Path) -> Result<(), GitError> {
    let mut cmd = Command::new("git");
    cmd.arg("pull").current_dir(cwd);

    let proxy_url = configure_proxy(&mut cmd);

    let output = cmd.output().map_err(GitError::Io)?;

    if !output.status.success() {
        let mut stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if let Some(url) = proxy_url {
             use std::fmt::Write;
             let _ = write!(stderr, "\n[parallel-cli-runner] System proxy detected and used: {}", url);
        }

        return Err(GitError::GitFailed {
            code: output.status.code(),
            stderr,
        });
    }
    Ok(())
}

pub fn push(cwd: &Path, force: bool) -> Result<(), GitError> {
    let mut cmd = Command::new("git");
    cmd.arg("push").current_dir(cwd);
    
    if force {
        cmd.arg("--force");
    }

    let proxy_url = configure_proxy(&mut cmd);

    let output = cmd.output().map_err(GitError::Io)?;

    if !output.status.success() {
        let mut stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if let Some(url) = proxy_url {
             use std::fmt::Write;
             let _ = write!(stderr, "\n[parallel-cli-runner] System proxy detected and used: {}", url);
        }

        return Err(GitError::GitFailed {
            code: output.status.code(),
            stderr,
        });
    }
    Ok(())
}
