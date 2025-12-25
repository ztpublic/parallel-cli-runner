import { useState, useEffect, useRef } from "react";
import { Icon } from "../Icons";

type CreateWorktreeDialogProps = {
  open: boolean;
  repoName: string;
  onClose: () => void;
  onConfirm: (branchName: string, path: string) => void;
};

export function CreateWorktreeDialog({
  open,
  repoName,
  onClose,
  onConfirm,
}: CreateWorktreeDialogProps) {
  const [branchName, setBranchName] = useState("");
  const [path, setPath] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setBranchName("");
      setPath(`../${repoName}-worktree`);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open, repoName]);

  useEffect(() => {
    if (open && branchName) {
      setPath(`../${repoName}-${branchName}`);
    }
  }, [branchName, open, repoName]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (branchName.trim() && path.trim()) {
      onConfirm(branchName.trim(), path.trim());
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
          <div className="dialog-title">Create Worktree</div>
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
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="dialog-field">
            <label htmlFor="worktree-path" className="dialog-label">
              Worktree Path
            </label>
            <input
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
              disabled={!branchName.trim() || !path.trim()}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
