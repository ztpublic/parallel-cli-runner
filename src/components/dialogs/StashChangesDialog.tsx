import { useState, useEffect, useRef } from "react";
import { Icon } from "../Icons";

type StashChangesDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (message: string) => void;
};

export function StashChangesDialog({
  open,
  onClose,
  onConfirm,
}: StashChangesDialogProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMessage("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(message.trim());
    onClose();
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
          <div className="dialog-title">Stash Changes</div>
          <button type="button" className="icon-button" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="dialog-body">
          <div className="dialog-field">
            <label htmlFor="stash-message" className="dialog-label">
              Message (optional)
            </label>
            <input
              ref={inputRef}
              id="stash-message"
              type="text"
              className="dialog-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="My stash"
            />
          </div>

          <div className="dialog-footer">
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="dialog-button dialog-button--primary"
            >
              Stash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
