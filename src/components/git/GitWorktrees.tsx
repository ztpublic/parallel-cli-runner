import { Icon } from "../Icons";
import { RepoGroup, WorktreeItem } from "../../types/git-ui";

type GitWorktreesProps = {
  worktreeGroups: RepoGroup<WorktreeItem>[];
};

export function GitWorktrees({ worktreeGroups }: GitWorktreesProps) {
  return (
    <div className="git-tree">
      {worktreeGroups.map((group) => (
        <div key={group.repo.repoId} className="git-tree-node">
          <div className="git-tree-header git-tree-header--static">
            <Icon name="folder" size={14} />
            <div className="git-tree-title">
              <span>{group.repo.name}</span>
              <span className="git-tree-path">{group.repo.path}</span>
            </div>
            <span className="git-section-spacer" />
            <span className="git-pill">{group.items.length}</span>
          </div>
          <div className="git-tree-children">
            <div className="git-list git-list--branches">
              {group.items.map((worktree) => (
                <div
                  key={`${group.repo.repoId}:${worktree.branch}`}
                  className="git-item"
                >
                  <Icon name="folder" size={14} />
                  <div className="git-item-body">
                    <div className="git-item-title">
                      <span className="git-item-name">{worktree.branch}</span>
                    </div>
                    <div className="git-item-meta">{worktree.path}</div>
                  </div>
                  <div className="git-item-actions">
                    <button type="button" className="icon-button icon-button--tiny" title="Open">
                      <Icon name="terminal" size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      {!worktreeGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}
    </div>
  );
}
