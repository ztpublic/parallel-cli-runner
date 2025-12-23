import { Icon } from "./Icons";
import type { RepoInfoDto } from "../types/git";

type RepoPickerModalProps = {
  open: boolean;
  repos: RepoInfoDto[];
  selectedRepoIds: string[];
  error?: string | null;
  onToggleRepo: (repoId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function RepoPickerModal({
  open,
  repos,
  selectedRepoIds,
  error,
  onToggleRepo,
  onSelectAll,
  onClear,
  onConfirm,
  onClose,
}: RepoPickerModalProps) {
  if (!open) return null;

  const selectedCount = selectedRepoIds.length;
  const confirmDisabled = selectedCount === 0 || repos.length === 0;

  return (
    <div
      className="repo-picker-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="repo-picker" role="dialog" aria-modal="true" aria-label="Bind repositories">
        <div className="repo-picker-header">
          <div className="repo-picker-title">
            <Icon name="folder" size={18} />
            <div>
              <div className="repo-picker-title-text">Bind Repositories</div>
              <div className="repo-picker-subtitle">
                {repos.length ? `Found ${repos.length} repositories` : "No repositories found"}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            title="Close"
            onClick={onClose}
          >
            <Icon name="close" size={12} />
          </button>
        </div>

        {error ? <div className="repo-picker-error">{error}</div> : null}

        <div className="repo-picker-actions">
          <button type="button" className="repo-picker-action" onClick={onSelectAll}>
            Select all
          </button>
          <button type="button" className="repo-picker-action" onClick={onClear}>
            Clear
          </button>
          <div className="repo-picker-count">{selectedCount} selected</div>
        </div>

        <div className="repo-picker-list">
          {repos.map((repo) => {
            const checked = selectedRepoIds.includes(repo.repo_id);
            return (
              <label key={repo.repo_id} className="repo-picker-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleRepo(repo.repo_id)}
                />
                <div className="repo-picker-item-body">
                  <div className="repo-picker-item-title">
                    <span>{repo.name || "Unnamed repo"}</span>
                    {repo.is_bare ? (
                      <span className="repo-picker-badge">bare</span>
                    ) : null}
                  </div>
                  <div className="repo-picker-item-path">{repo.root_path}</div>
                </div>
              </label>
            );
          })}
          {!repos.length && !error ? (
            <div className="repo-picker-empty">Select another folder to scan again.</div>
          ) : null}
        </div>

        <div className="repo-picker-footer">
          <button type="button" className="repo-picker-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="repo-picker-button repo-picker-button--primary"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            Bind selected
          </button>
        </div>
      </div>
    </div>
  );
}
