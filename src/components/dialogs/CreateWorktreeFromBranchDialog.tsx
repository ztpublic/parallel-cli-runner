import { useState, useEffect, useRef } from "react";
import { Icon } from "../Icons";

type CreateWorktreeFromBranchDialogProps = {
  open: boolean;
  repoName: string;
  branchName: string;
  onClose: () => void;
  onConfirm: (branchName: string, path: string) => void;
};

export function CreateWorktreeFromBranchDialog({
  open,
  repoName,
  branchName,
  onClose,
  onConfirm,
}: CreateWorktreeFromBranchDialogProps) {
  const [path, setPath] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPath(`../${repoName}-${branchName}`);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, repoName, branchName]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (path.trim()) {
      onConfirm(branchName, path.trim());
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
          <div className="dialog-title">Create Worktree for Branch</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          <div className="dialog-field">
            <label htmlFor="branch-name" className="dialog-label">
              Branch
            </label>
            <input
              id="branch-name"
              type="text"
              className="dialog-input"
              value={branchName}
              disabled
            />
          </div>

          <div className="dialog-field">
            <label htmlFor="worktree-path" className="dialog-label">
              Worktree Path
            </label>
            <input
              ref={inputRef}
              id="worktree-path"
              type="text"
              className="dialog-input"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="dialog-footer">
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="dialog-button dialog-button--primary"
              disabled={!path.trim()}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
