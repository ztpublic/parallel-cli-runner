import { Icon } from "../Icons";
import { WorktreeItem } from "../../types/git-ui";

type GitWorktreesProps = {
  worktrees: WorktreeItem[];
};

export function GitWorktrees({ worktrees }: GitWorktreesProps) {
  return (
    <div className="git-list git-list--branches">
      {worktrees.map((worktree) => (
        <div key={worktree.branch} className="git-item">
          <Icon name="folder" size={14} />
          <div className="git-item-body">
            <div className="git-item-title">
              <span className="git-item-name">{worktree.branch}</span>
            </div>
            <div className="git-item-meta">{worktree.path}</div>
          </div>
          <div className="git-item-actions">
            <button type="button" className="icon-button icon-button--tiny" title="Merge">
              <Icon name="merge" size={12} />
            </button>
            <button
              type="button"
              className="icon-button icon-button--tiny icon-button--danger"
              title="Delete"
            >
              <Icon name="trash" size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
