import { useState, useEffect, useRef } from "react";
import { Icon } from "../Icons";

type CreateBranchDialogProps = {
  open: boolean;
  sourceBranch?: string;
  onClose: () => void;
  onConfirm: (branchName: string) => void;
};

export function CreateBranchDialog({
  open,
  sourceBranch,
  onClose,
  onConfirm,
}: CreateBranchDialogProps) {
  const [branchName, setBranchName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setBranchName("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (branchName.trim()) {
      onConfirm(branchName.trim());
      onClose();
    }
  };

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-modal">
        <div className="dialog-header">
          <div className="dialog-title">Create New Branch</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="dialog-body">
          <div className="dialog-field">
            <label htmlFor="branch-name" className="dialog-label">
              Branch Name
            </label>
            <input
              ref={inputRef}
              id="branch-name"
              type="text"
              className="dialog-input"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/new-feature"
              autoComplete="off"
            />
          </div>
          
          {sourceBranch && (
            <div className="dialog-info">
              <Icon name="branch" size={12} />
              <span>Based on <strong>{sourceBranch}</strong></span>
            </div>
          )}

          <div className="dialog-footer">
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="dialog-button dialog-button--primary"
              disabled={!branchName.trim()}
            >
              Create Branch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
