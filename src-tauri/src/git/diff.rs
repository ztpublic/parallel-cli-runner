use crate::git::error::GitError;
use crate::git::status::open_repo;
use crate::git::types::{
    DiffCompareKind, DiffDeltaStatus, DiffFileSummaryDto, DiffMetaDto, DiffRequestDto,
    DiffRequestOptionsDto, DiffResponseDto,
};
use git2::{Delta, Diff, DiffFindOptions, DiffFormat, DiffOptions, ErrorCode};
use sha2::{Digest, Sha256};
use std::path::Path;

pub fn get_unified_diff(req: DiffRequestDto) -> Result<DiffResponseDto, GitError> {
    let repo = open_repo(Path::new(&req.repo_path))?;
    let paths = req.paths.clone().unwrap_or_default();
    let (mut opts, context_lines, _include_untracked) =
        build_diff_options(&paths, req.options.as_ref());
    let compare_kind = req.compare_kind.clone();

    let diff = match compare_kind {
        DiffCompareKind::WorktreeHead => {
            let head_tree = match repo.head() {
                Ok(head) => Some(head.peel_to_tree()?),
                Err(err) if err.code() == ErrorCode::UnbornBranch => None,
                Err(err) => return Err(GitError::Git2(err)),
            };
            opts.include_untracked(true).recurse_untracked_dirs(true);
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

fn index_conflicted_paths(repo: &git2::Repository) -> Result<Vec<String>, GitError> {
    let index = repo.index()?;
    let mut paths = std::collections::HashSet::new();
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
