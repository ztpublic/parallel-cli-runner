import { Icon } from "../Icons";

type RebaseWorktreeGuardDialogProps = {
  open: boolean;
  targetBranch: string;
  ontoBranch: string;
  worktreePath: string;
  hasDirtyWorktree: boolean;
  onClose: () => void;
  onConfirmDetach: () => void;
};

export function RebaseWorktreeGuardDialog({
  open,
  targetBranch,
  ontoBranch,
  worktreePath,
  hasDirtyWorktree,
  onClose,
  onConfirmDetach,
}: RebaseWorktreeGuardDialogProps) {
  if (!open) return null;

  return (
    <div
      className="dialog-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-modal">
        <div className="dialog-header">
          <div className="dialog-title">Rebase Blocked</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="dialog-body">
          <div className="dialog-info">
            <Icon name="alert" size={12} />
            <span>
              <strong>{targetBranch}</strong> is checked out in another worktree.
            </span>
          </div>
          <p className="dialog-label" style={{ marginTop: 8 }}>
            Git cannot rebase <strong>{targetBranch}</strong> onto{" "}
            <strong>{ontoBranch}</strong> while that branch is active elsewhere.
          </p>
          <p className="dialog-label">Worktree: {worktreePath}</p>
          {hasDirtyWorktree ? (
            <p className="dialog-label">
              Note: this worktree has uncommitted changes. Detaching may fail
              or leave those changes in place.
            </p>
          ) : null}

          <div className="dialog-footer">
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="dialog-button dialog-button--primary"
              onClick={() => {
                onConfirmDetach();
                onClose();
              }}
            >
              Detach Worktree &amp; Rebase
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
