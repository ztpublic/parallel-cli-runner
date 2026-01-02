import { Icon } from "../Icons";

type StageAllAndCommitDialogProps = {
  open: boolean;
  repoCount: number;
  onClose: () => void;
  onConfirm: () => void;
};

export function StageAllAndCommitDialog({
  open,
  repoCount,
  onClose,
  onConfirm,
}: StageAllAndCommitDialogProps) {
  if (!open) return null;

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-modal">
        <div className="dialog-header">
          <div className="dialog-title">Stage All and Commit</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="dialog-body">
          <div className="dialog-info">
            <Icon name="alert" size={12} />
            <span>
              {repoCount > 1
                ? `${repoCount} repositories have `
                : "This repository has "}
              no staged changes but has unstaged changes.
            </span>
          </div>
          <p className="dialog-label" style={{ marginTop: 8 }}>
            Do you want to stage all changes and commit?
          </p>

          <div className="dialog-footer">
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="dialog-button dialog-button--primary"
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              Stage All & Commit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
