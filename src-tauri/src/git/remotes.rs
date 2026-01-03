use crate::git::error::GitError;
use crate::git::proxy::configure_proxy;
use crate::git::status::open_repo;
use crate::git::types::RemoteInfoDto;
use std::path::Path;
use std::process::Command;

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

pub fn pull(cwd: &Path) -> Result<(), GitError> {
    let _ = run_git_command(cwd, ["pull"])?;
    Ok(())
}

pub fn push(cwd: &Path, force: bool) -> Result<(), GitError> {
    let mut args = vec!["push"];
    if force {
        args.push("--force");
    }
    let _ = run_git_command(cwd, args)?;
    Ok(())
}

fn run_git_command<I, S>(cwd: &Path, args: I) -> Result<std::process::Output, GitError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    let mut cmd = Command::new("git");
    cmd.args(args).current_dir(cwd);

    let proxy_url = configure_proxy(&mut cmd);
    let output = cmd.output().map_err(GitError::Io)?;

    if !output.status.success() {
        let mut stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if let Some(url) = proxy_url {
            use std::fmt::Write;
            let _ = write!(
                stderr,
                "\n[parallel-cli-runner] System proxy detected and used: {}",
                url
            );
        }

        return Err(GitError::GitFailed {
            code: output.status.code(),
            stderr,
        });
    }
    Ok(output)
}
