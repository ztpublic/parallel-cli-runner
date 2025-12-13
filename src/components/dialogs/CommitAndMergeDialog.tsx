import type { Agent } from "../../types/agent";

type Props = {
  open: boolean;
  agent: Agent | null;
  baseBranch: string | null;
  commitMessage: string;
  onChangeCommitMessage: (value: string) => void;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CommitAndMergeDialog({
  open,
  agent,
  baseBranch,
  commitMessage,
  onChangeCommitMessage,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  if (!open || !agent) return null;

  const targetBranchLabel = baseBranch ?? "\u2014";

  return (
    <div
      className="agent-dialog-backdrop"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div className="agent-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="agent-dialog-header">
          <h3>Commit and merge</h3>
          <p className="muted">
            Commit changes on <code>{agent.branch_name}</code> and merge into{" "}
            <code>{targetBranchLabel}</code>.
          </p>
        </div>
        <label className="field">
          <span>Commit message</span>
          <input
            value={commitMessage}
            onChange={(event) => onChangeCommitMessage(event.target.value)}
            placeholder="Describe your changes"
            disabled={busy}
          />
        </label>
        {error ? <div className="agent-error">{error}</div> : null}
        <div className="dialog-actions">
          <button className="chip" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="chip primary"
            onClick={onConfirm}
            disabled={busy || !commitMessage.trim() || !baseBranch}
          >
            {busy ? "Working..." : "Commit & merge"}
          </button>
        </div>
      </div>
    </div>
  );
}

