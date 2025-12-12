type Props = {
  open: boolean;
  creating: boolean;
  repoRootPathLabel: string;
  agentName: string;
  onChangeAgentName: (value: string) => void;
  startCommand: string;
  onChangeStartCommand: (value: string) => void;
  error?: string | null;
  placeholderAgentName?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CreateAgentDialog({
  open,
  creating,
  repoRootPathLabel,
  agentName,
  onChangeAgentName,
  startCommand,
  onChangeStartCommand,
  error,
  placeholderAgentName,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="agent-dialog-backdrop"
      onClick={() => {
        if (!creating) onCancel();
      }}
    >
      <div className="agent-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="agent-dialog-header">
          <h3>Create new agent</h3>
          <p className="muted">
            Creates a worktree in {repoRootPathLabel} and runs the start command.
          </p>
        </div>
        <label className="field">
          <span>Agent name</span>
          <input
            value={agentName}
            onChange={(e) => onChangeAgentName(e.target.value)}
            placeholder={placeholderAgentName}
          />
        </label>
        <label className="field">
          <span>Starting command</span>
          <input
            value={startCommand}
            onChange={(e) => onChangeStartCommand(e.target.value)}
            placeholder="npm start"
          />
        </label>
        {error ? <div className="agent-error">{error}</div> : null}
        <div className="dialog-actions">
          <button className="chip" onClick={onCancel} disabled={creating}>
            Cancel
          </button>
          <button className="chip primary" onClick={onConfirm} disabled={creating}>
            {creating ? "Creating..." : "Create agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

