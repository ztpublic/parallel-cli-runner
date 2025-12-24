import { Icon } from "../Icons";

type RevertDialogProps = {
  open: boolean;
  commitHash?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function RevertDialog({
  open,
  commitHash,
  onClose,
  onConfirm,
}: RevertDialogProps) {
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
          <div className="dialog-title">Revert Commit</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="dialog-body">
          {commitHash && (
            <div className="dialog-info">
              <Icon name="commit" size={12} />
              <span>Reverting commit <strong>{commitHash}</strong></span>
            </div>
          )}
          <p className="dialog-label" style={{ marginTop: 8 }}>
            This will create a new commit that undoes the changes from this commit.
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
              Revert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
