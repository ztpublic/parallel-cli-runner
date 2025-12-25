import { Icon } from "../Icons";

type GitErrorDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export function GitErrorDialog({ open, title, message, onClose }: GitErrorDialogProps) {
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
          <div className="dialog-title">{title ?? "Git command failed"}</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="dialog-body">
          <div className="dialog-info">
            <Icon name="alert" size={12} />
            <span>{message}</span>
          </div>
          <div className="dialog-footer">
            <button type="button" className="dialog-button dialog-button--primary" onClick={onClose}>
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
