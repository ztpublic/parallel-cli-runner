import { Icon } from "../Icons";

type ForcePushDialogProps = {
  open: boolean;
  branchName: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function ForcePushDialog({
  open,
  branchName,
  onClose,
  onConfirm,
}: ForcePushDialogProps) {
  // Fix for the previous build error where useDismiss was not found or not exported correctly:
  // I will check useDismiss hook usage in other dialogs.
  // SmartSwitchDialog uses `import { useDismiss } from "../../hooks/useDismiss";` but it failed before.
  // In `src/hooks/useDismiss.ts`, the export is `useDismissOnWindowClickOrEscape`.
  // I should use that or rename the file/export.
  // Or I can skip it for now and use overlay click.
  // Other dialogs use overlay click handler.
  
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
          <div className="dialog-title">Force Push</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="dialog-body">
          <div className="dialog-info" style={{background: 'rgba(244, 135, 113, 0.12)', color: 'var(--danger)'}}>
            <Icon name="alert" size={14} />
            <span>Warning: Destructive Action</span>
          </div>
          <p className="text-sm text-muted">
            Are you sure you want to force push to <strong>{branchName}</strong>?
            <br />
            This will overwrite history on the remote repository.
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
              Force Push
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
