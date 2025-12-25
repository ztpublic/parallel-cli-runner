import { Icon } from "../Icons";

type DeleteWorktreeDialogProps = {
  open: boolean;
  branchName?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteWorktreeDialog({
  open,
  branchName,
  onClose,
  onConfirm,
}: DeleteWorktreeDialogProps) {
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
          <div className="dialog-title">Delete Worktree</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="dialog-body">
          {branchName && (
            <div className="dialog-info">
              <Icon name="trash" size={12} />
              <span>Deleting worktree for branch <strong>{branchName}</strong></span>
            </div>
          )}
          <p className="dialog-label" style={{ marginTop: 8 }}>
            This will remove the worktree folder and delete the associated branch. This action cannot be undone.
          </p>

          <div className="dialog-footer">
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="dialog-button dialog-button--primary dialog-button--danger"
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
