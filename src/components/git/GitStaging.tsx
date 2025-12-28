import { Icon } from "../Icons";
import { ChangeStatus, ChangedFile, RepoGroup } from "../../types/git-ui";
import { useGitStaging } from "../../hooks/git/useGitStaging";

type GitStagingProps = {
  groups: RepoGroup<ChangedFile>[];
  onCommit: (repoId: string, message: string) => void;
  onStageAll: (repoId: string) => void;
  onUnstageAll: (repoId: string) => void;
  onStageFile: (repoId: string, path: string) => void;
  onUnstageFile: (repoId: string, path: string) => void;
};

function GitRepoStagingItem({
  group,
  onCommit,
  onStageAll,
  onUnstageAll,
  onStageFile,
  onUnstageFile,
}: {
  group: RepoGroup<ChangedFile>;
  onCommit: (repoId: string, message: string) => void;
  onStageAll: (repoId: string) => void;
  onUnstageAll: (repoId: string) => void;
  onStageFile: (repoId: string, path: string) => void;
  onUnstageFile: (repoId: string, path: string) => void;
}) {
  const {
    commitMessage,
    setCommitMessage,
    stagedFiles,
    unstagedFiles,
    generateCommitMessage,
  } = useGitStaging(group.items);

  const commitDisabled = !commitMessage.trim() || stagedFiles.length === 0;
  const magicDisabled = stagedFiles.length === 0;

  const handleCommit = () => {
    onCommit(group.repo.repoId, commitMessage);
    setCommitMessage(""); 
  };

  const getStatusLabel = (status: ChangeStatus) => {
    switch (status) {
      case "added":
        return "A";
      case "deleted":
        return "D";
      default:
        return "M";
    }
  };

  const getStatusIcon = (status: ChangeStatus) => {
    switch (status) {
      case "added":
        return "fileAdd";
      case "deleted":
        return "fileRemove";
      default:
        return "fileEdit";
    }
  };

  return (
    <div className="commit-panel repo-commit-panel">
      <div className="repo-header-small">
        <Icon name="folder" size={14} />
        <span>{group.repo.name}</span>
      </div>
      
      <div className="commit-message">
        <div className="commit-textarea-wrap">
          <textarea
            className="commit-textarea"
            placeholder={`Commit to ${group.repo.name}...`}
            rows={3}
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            spellCheck={false}
          />
          <button
            type="button"
            className="commit-magic"
            onClick={generateCommitMessage}
            disabled={magicDisabled}
            title="Generate commit message"
          >
            <Icon name="sparkle" size={12} />
          </button>
        </div>
        <button
          type="button"
          className="commit-button"
          disabled={commitDisabled}
          onClick={handleCommit}
        >
          <Icon name="check" size={14} />
          Commit
        </button>
      </div>

      <div className="commit-files">
        {stagedFiles.length ? (
          <div className="commit-section">
            <div className="commit-section-header">
              <div className="commit-section-title commit-section-title--staged">Staged</div>
              <div className="commit-section-count">{stagedFiles.length}</div>
              <button 
                type="button" 
                className="commit-section-action" 
                onClick={() => onUnstageAll(group.repo.repoId)}
              >
                Unstage All
              </button>
            </div>
            <div className="commit-file-list">
              {stagedFiles.map((file) => (
                <div key={`${file.path}:staged`} className="commit-file">
                  <Icon
                    name={getStatusIcon(file.status)}
                    size={14}
                    className={`commit-file-icon commit-file-icon--${file.status}`}
                  />
                  <span className={`commit-file-status commit-file-status--${file.status}`}>
                    {getStatusLabel(file.status)}
                  </span>
                  <span className="commit-file-path">{file.path}</span>
                  <button
                    type="button"
                    className="icon-button icon-button--tiny commit-file-action commit-file-action--unstage"
                    title="Unstage file"
                    onClick={() => onUnstageFile(group.repo.repoId, file.path)}
                  >
                    <Icon name="minus" size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {unstagedFiles.length ? (
          <div className="commit-section">
            <div className="commit-section-header">
              <div className="commit-section-title">Unstaged</div>
              <div className="commit-section-count">{unstagedFiles.length}</div>
              <button 
                type="button" 
                className="commit-section-action" 
                onClick={() => onStageAll(group.repo.repoId)}
              >
                Stage All
              </button>
            </div>
            <div className="commit-file-list">
              {unstagedFiles.map((file) => (
                <div key={`${file.path}:unstaged`} className="commit-file">
                  <Icon
                    name={getStatusIcon(file.status)}
                    size={14}
                    className={`commit-file-icon commit-file-icon--${file.status}`}
                  />
                  <span className={`commit-file-status commit-file-status--${file.status}`}>
                    {getStatusLabel(file.status)}
                  </span>
                  <span className="commit-file-path">{file.path}</span>
                  <button
                    type="button"
                    className="icon-button icon-button--tiny commit-file-action commit-file-action--stage"
                    title="Stage file"
                    onClick={() => onStageFile(group.repo.repoId, file.path)}
                  >
                    <Icon name="plus" size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GitStaging({ groups, ...props }: GitStagingProps) {
  const dirtyGroups = groups.filter(g => g.items.length > 0);

  if (!dirtyGroups.length) {
    return (
      <div className="git-empty">
        <Icon name="check" size={22} />
        <p>All repositories clean.</p>
      </div>
    );
  }

  return (
    <div className="git-staging-list">
      {dirtyGroups.map((group) => (
        <GitRepoStagingItem key={group.repo.repoId} group={group} {...props} />
      ))}
    </div>
  );
}