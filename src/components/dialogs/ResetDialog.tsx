import { useState, useEffect } from "react";
import { Icon } from "../Icons";

type ResetMode = "soft" | "mixed" | "hard";

type ResetDialogProps = {
  open: boolean;
  commitHash?: string;
  onClose: () => void;
  onConfirm: (mode: ResetMode) => void;
};

export function ResetDialog({
  open,
  commitHash,
  onClose,
  onConfirm,
}: ResetDialogProps) {
  const [mode, setMode] = useState<ResetMode>("mixed");

  useEffect(() => {
    if (open) {
      setMode("mixed");
    }
  }, [open]);

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
          <div className="dialog-title">Reset to Commit</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="dialog-body">
          {commitHash && (
            <div className="dialog-info">
              <Icon name="commit" size={12} />
              <span>Resetting to <strong>{commitHash}</strong></span>
            </div>
          )}

          <div className="dialog-field">
            <label className="dialog-label">Reset Mode</label>
            <div className="dialog-radio-group">
              <label className="dialog-radio">
                <input
                  type="radio"
                  name="reset-mode"
                  checked={mode === "soft"}
                  onChange={() => setMode("soft")}
                />
                <div className="dialog-radio-label">
                  <strong>Soft</strong>
                  <span>Keep changes staged</span>
                </div>
              </label>
              <label className="dialog-radio">
                <input
                  type="radio"
                  name="reset-mode"
                  checked={mode === "mixed"}
                  onChange={() => setMode("mixed")}
                />
                <div className="dialog-radio-label">
                  <strong>Mixed</strong>
                  <span>Keep changes unstaged</span>
                </div>
              </label>
              <label className="dialog-radio">
                <input
                  type="radio"
                  name="reset-mode"
                  checked={mode === "hard"}
                  onChange={() => setMode("hard")}
                />
                <div className="dialog-radio-label">
                  <strong>Hard</strong>
                  <span>Discard all changes</span>
                </div>
              </label>
            </div>
          </div>

          <div className="dialog-footer">
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={`dialog-button dialog-button--primary ${
                mode === "hard" ? "dialog-button--danger" : ""
              }`}
              onClick={() => {
                onConfirm(mode);
                onClose();
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
