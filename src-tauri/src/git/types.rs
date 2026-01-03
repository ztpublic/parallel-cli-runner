use serde::{Deserialize, Serialize};
use ts_rs::TS;

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
pub struct SubmoduleInfoDto {
    pub name: String,
    pub path: String,
    pub url: Option<String>,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct WorktreeInfoDto {
    pub branch: String,
    pub path: String,
    pub ahead: i32,
    pub behind: i32,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct StashInfoDto {
    pub index: i32,
    pub message: String,
    pub id: String,
    pub relative_time: String,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct TagInfoDto {
    pub name: String,
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
