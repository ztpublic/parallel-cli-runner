use crate::git::error::GitError;
use crate::git::status::open_repo;
use crate::git::types::TagInfoDto;
use std::path::Path;

pub fn list_tags(
    cwd: &Path,
    limit: usize,
    skip: Option<usize>,
) -> Result<Vec<TagInfoDto>, GitError> {
    let repo = open_repo(cwd)?;
    let names = repo.tag_names(None)?;
    let mut tag_names = Vec::new();
    for name in names.iter().flatten() {
        tag_names.push(name.to_string());
    }
    tag_names.sort();
    let skip = skip.unwrap_or(0);
    let tags = tag_names
        .into_iter()
        .skip(skip)
        .take(limit)
        .map(|name| TagInfoDto { name })
        .collect();
    Ok(tags)
}
