import { Icon } from "../Icons";

type SquashCommitsDialogProps = {
  open: boolean;
  commitCount: number;
  onClose: () => void;
  onConfirm: () => void;
};

export function SquashCommitsDialog({
  open,
  commitCount,
  onClose,
  onConfirm,
}: SquashCommitsDialogProps) {
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
          <div className="dialog-title">Squash Commits</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="dialog-body">
          <div
            className="dialog-info"
            style={{ background: "rgba(244, 135, 113, 0.12)", color: "var(--danger)" }}
          >
            <Icon name="alert" size={14} />
            <span>Warning: Published History</span>
          </div>
          <p className="text-sm text-muted">
            {commitCount} selected {commitCount === 1 ? "commit is" : "commits are"} already on a
            remote branch. Squashing will rewrite published history and may require a force push.
          </p>
          <div className="dialog-footer">
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="dialog-button dialog-button--danger"
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              Squash Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
