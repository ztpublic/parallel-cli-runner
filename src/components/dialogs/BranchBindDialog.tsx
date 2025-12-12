import type { BranchInfo } from "../../types/agent";

type Props = {
  open: boolean;
  branches: BranchInfo[];
  selection: string;
  onChangeSelection: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  pendingRepoPath?: string | null;
};

export function BranchBindDialog({
  open,
  branches,
  selection,
  onChangeSelection,
  onCancel,
  onConfirm,
  busy,
  pendingRepoPath,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="agent-dialog-backdrop"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div className="agent-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="agent-dialog-header">
          <h3>Select branch to bind</h3>
          <p className="muted">
            Bind to a branch; agent worktrees will merge back into this branch.
          </p>
        </div>
        <label className="field">
          <span>Branch</span>
          <select
            value={selection}
            onChange={(event) => onChangeSelection(event.target.value)}
            disabled={busy}
          >
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
                {branch.current ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="dialog-actions">
          <button className="chip" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="chip primary"
            onClick={onConfirm}
            disabled={busy || !selection || !pendingRepoPath}
          >
            Bind repo
          </button>
        </div>
      </div>
    </div>
  );
}

