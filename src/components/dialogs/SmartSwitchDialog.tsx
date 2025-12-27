import { Icon } from "../Icons";

type SmartSwitchDialogProps = {
  open: boolean;
  branchName: string;
  onClose: () => void;
  onConfirmSmart: () => void;
  onConfirmForce: () => void;
};

export function SmartSwitchDialog({
  open,
  branchName,
  onClose,
  onConfirmSmart,
  onConfirmForce,
}: SmartSwitchDialogProps) {
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
          <div className="dialog-title">Switch to {branchName}</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="dialog-body">
          <p style={{ marginBottom: "12px" }}>
            You have uncommitted changes. How would you like to proceed?
          </p>
          <div className="dialog-info" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
             <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
               <Icon name="alert" size={16} />
               <span style={{ fontWeight: 600 }}>Action Required</span>
             </div>
             <p className="text-sm text-muted" style={{ margin: 0, paddingLeft: "24px" }}>
               <strong>Smart Switch:</strong> Stashes changes, switches branch, and pops stash.
               <br/>
               <strong>Force Switch:</strong> Discards local changes (Dangerous).
             </p>
          </div>
          <div className="dialog-footer">
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="dialog-button dialog-button--danger"
              onClick={() => {
                onConfirmForce();
                onClose();
              }}
            >
              Force Switch
            </button>
            <button
              type="button"
              className="dialog-button dialog-button--primary"
              onClick={() => {
                onConfirmSmart();
                onClose();
              }}
            >
              Smart Switch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}