use git2::{
    build::CheckoutBuilder,
    BranchType, Diff, DiffOptions, DiffStatsFormat, ErrorCode, IndexAddOption, MergeOptions,
    Repository, StashFlags, Status, StatusOptions, StatusShow, WorktreeAddOptions,
    WorktreePruneOptions,
};
use serde::Serialize;
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
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
pub struct FileStatusDto {
    pub path: String,
    pub staged: Option<FileChangeType>,
    pub unstaged: Option<FileChangeType>,
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

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut has_untracked = false;
    let mut has_staged = false;
    let mut has_unstaged = false;
    let mut conflicted_files = 0usize;
    let mut modified_files = Vec::new();

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

        modified_files.push(FileStatusDto {
            path: path.to_string(),
            staged,
            unstaged,
        });
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
    let mut repos = Vec::new();

    if let Ok(repo) = Repository::discover(root) {
        let info = repo_info_from_repo(&repo);
        if seen.insert(info.root_path.clone()) {
            repos.push(info);
        }
    }

    let mut pending = vec![root.to_path_buf()];
    while let Some(dir) = pending.pop() {
        progress_cb(dir.to_string_lossy().to_string());
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        let git_marker = dir.join(".git");
        if fs::symlink_metadata(&git_marker).is_ok() {
            if let Ok(repo) = Repository::discover(&dir) {
                let info = repo_info_from_repo(&repo);
                if seen.insert(info.root_path.clone()) {
                    repos.push(info);
                }
            }
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
        let (branch, _branch_type) = branch?;
        let name = branch.name()?.unwrap_or_default().to_string();
        if !name.is_empty() {
            let last_commit = branch_last_commit(&branch)?;
            branches.push(BranchInfoDto {
                name,
                current: branch.is_head(),
                last_commit,
            });
        }
    }
    Ok(branches)
}

pub fn list_remote_branches(cwd: &Path) -> Result<Vec<BranchInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let mut branches = Vec::new();
    for branch in repo.branches(Some(BranchType::Remote))? {
        let (branch, _branch_type) = branch?;
        let Some(name) = branch.name()? else {
            continue;
        };
        let name = name.to_string();
        if name.is_empty() || name.ends_with("/HEAD") {
            continue;
        }
        let last_commit = branch_last_commit(&branch)?;
        branches.push(BranchInfoDto {
            name,
            current: false,
            last_commit,
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
        let worktree = repo.find_worktree(name)?;
        let path = worktree.path();
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

pub fn list_commits(cwd: &Path, limit: usize) -> Result<Vec<CommitInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let mut revwalk = match repo.revwalk() {
        Ok(walk) => walk,
        Err(err) if err.code() == ErrorCode::UnbornBranch => return Ok(Vec::new()),
        Err(err) => return Err(GitError::Git2(err)),
    };
    if let Err(err) = revwalk.push_head() {
        if err.code() == ErrorCode::UnbornBranch {
            return Ok(Vec::new());
        }
        return Err(GitError::Git2(err));
    }
    let mut commits = Vec::new();
    for oid in revwalk.take(limit) {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
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
    let worktree_name = worktree_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(branch);
    let mut opts = WorktreeAddOptions::new();
    let reference = branch_ref.into_reference();
    opts.reference(Some(&reference));
    repo.worktree(worktree_name, worktree_path, Some(&opts))?;
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
