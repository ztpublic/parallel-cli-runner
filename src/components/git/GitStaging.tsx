import { Icon } from "../Icons";
import { ChangeStatus, ChangedFile } from "../../types/git-ui";

type GitStagingProps = {
  stagedFiles: ChangedFile[];
  unstagedFiles: ChangedFile[];
  commitMessage: string;
  onCommitMessageChange: (message: string) => void;
  onGenerateCommitMessage: () => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onToggleFileStage: (path: string) => void;
};

export function GitStaging({
  stagedFiles,
  unstagedFiles,
  commitMessage,
  onCommitMessageChange,
  onGenerateCommitMessage,
  onStageAll,
  onUnstageAll,
  onToggleFileStage,
}: GitStagingProps) {
  const commitDisabled = !commitMessage.trim() || stagedFiles.length === 0;
  const magicDisabled = stagedFiles.length === 0;

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
    <div className="commit-panel">
      <div className="commit-message">
        <div className="commit-textarea-wrap">
          <textarea
            id="commit-message"
            className="commit-textarea"
            placeholder="Describe your changes..."
            rows={4}
            value={commitMessage}
            onChange={(event) => onCommitMessageChange(event.target.value)}
          />
          <button
            type="button"
            className="commit-magic"
            onClick={onGenerateCommitMessage}
            disabled={magicDisabled}
            title="Generate commit message"
          >
            <Icon name="sparkle" size={12} />
          </button>
        </div>
        <button type="button" className="commit-button" disabled={commitDisabled}>
          <Icon name="check" size={14} />
          Commit Changes
        </button>
      </div>

      <div className="commit-files">
        {stagedFiles.length ? (
          <div className="commit-section">
            <div className="commit-section-header">
              <div className="commit-section-title commit-section-title--staged">Staged</div>
              <div className="commit-section-count">{stagedFiles.length}</div>
              <button type="button" className="commit-section-action" onClick={onUnstageAll}>
                Unstage All
              </button>
            </div>
            <div className="commit-file-list">
              {stagedFiles.map((file) => (
                <div key={file.path} className="commit-file">
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
                    onClick={() => onToggleFileStage(file.path)}
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
              <button type="button" className="commit-section-action" onClick={onStageAll}>
                Stage All
              </button>
            </div>
            <div className="commit-file-list">
              {unstagedFiles.map((file) => (
                <div key={file.path} className="commit-file">
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
                    onClick={() => onToggleFileStage(file.path)}
                  >
                    <Icon name="plus" size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!stagedFiles.length && !unstagedFiles.length ? (
          <div className="commit-empty">
            <Icon name="commit" size={22} />
            <p>Working tree clean.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
