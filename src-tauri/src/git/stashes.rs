use crate::git::error::GitError;
use crate::git::status::open_repo;
use crate::git::types::StashInfoDto;
use std::path::Path;

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

pub fn apply_stash(cwd: &Path, index: i32) -> Result<(), GitError> {
    if index < 0 {
        return Err(GitError::GitFailed {
            code: None,
            stderr: "stash index must be >= 0".to_string(),
        });
    }
    let mut repo = open_repo(cwd)?;
    repo.stash_apply(index as usize, None)?;
    Ok(())
}

pub fn drop_stash(cwd: &Path, index: i32) -> Result<(), GitError> {
    if index < 0 {
        return Err(GitError::GitFailed {
            code: None,
            stderr: "stash index must be >= 0".to_string(),
        });
    }
    let mut repo = open_repo(cwd)?;
    repo.stash_drop(index as usize)?;
    Ok(())
}

pub fn stash_save(
    cwd: &Path,
    message: Option<String>,
    include_untracked: bool,
) -> Result<(), GitError> {
    let mut repo = open_repo(cwd)?;
    let sig = repo.signature()?;
    let flags = if include_untracked {
        Some(git2::StashFlags::INCLUDE_UNTRACKED)
    } else {
        Some(git2::StashFlags::DEFAULT)
    };
    let msg = message.as_deref().unwrap_or("");
    repo.stash_save(&sig, msg, flags)?;
    Ok(())
}

fn format_relative_time(time: git2::Time) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
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
