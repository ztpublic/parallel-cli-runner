import { Icon } from "../Icons";

type DeleteBranchDialogProps = {
  open: boolean;
  branchName?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteBranchDialog({
  open,
  branchName,
  onClose,
  onConfirm,
}: DeleteBranchDialogProps) {
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
          <div className="dialog-title">Delete Branch</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="dialog-body">
          {branchName ? (
            <div className="dialog-info">
              <Icon name="trash" size={12} />
              <span>Deleting branch <strong>{branchName}</strong></span>
            </div>
          ) : null}
          <p className="dialog-label" style={{ marginTop: 8 }}>
            This will delete the branch. This action cannot be undone.
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
