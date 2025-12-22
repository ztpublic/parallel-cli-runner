import { useState } from "react";
import { Icon } from "../Icons";
import { BranchItem } from "../../types/git-ui";

type GitBranchesProps = {
  localBranches: BranchItem[];
  remoteBranches: BranchItem[];
};

export function GitBranches({ localBranches, remoteBranches }: GitBranchesProps) {
  const [expanded, setExpanded] = useState<{ local: boolean; remote: boolean }>({
    local: true,
    remote: true,
  });

  return (
    <>
      <div className="git-section">
        <div className="git-section-header">
          <button
            type="button"
            className="git-section-toggle"
            onClick={() => setExpanded((prev) => ({ ...prev, local: !prev.local }))}
          >
            <Icon name={expanded.local ? "chevronDown" : "chevronRight"} size={14} />
            <span>Local Branches</span>
            <span className="git-section-spacer" />
            <span className="git-pill">{localBranches.length}</span>
          </button>
          <button type="button" className="icon-button icon-button--tiny" title="New Branch">
            <Icon name="plus" size={12} />
          </button>
        </div>
        {expanded.local ? (
          <div className="git-list git-list--branches">
            {localBranches.map((branch) => (
              <div
                key={branch.name}
                className={`git-item ${branch.current ? "git-item--current" : ""}`}
              >
                <Icon name="branch" size={14} />
                <div className="git-item-body">
                  <div className="git-item-title">
                    <span className="git-item-name">{branch.name}</span>
                    {branch.current ? <span className="git-badge">current</span> : null}
                  </div>
                  <div className="git-item-meta">{branch.lastCommit}</div>
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
        ) : null}
      </div>

      <div className="git-section">
        <div className="git-section-header">
          <button
            type="button"
            className="git-section-toggle"
            onClick={() => setExpanded((prev) => ({ ...prev, remote: !prev.remote }))}
          >
            <Icon name={expanded.remote ? "chevronDown" : "chevronRight"} size={14} />
            <span>Remote Branches</span>
            <span className="git-section-spacer" />
            <span className="git-pill">{remoteBranches.length}</span>
          </button>
        </div>
        {expanded.remote ? (
          <div className="git-list git-list--branches">
            {remoteBranches.map((branch) => (
              <div key={branch.name} className="git-item">
                <Icon name="cloud" size={14} />
                <div className="git-item-body">
                  <div className="git-item-title">
                    <span className="git-item-name">{branch.name}</span>
                  </div>
                  <div className="git-item-meta">{branch.lastCommit}</div>
                </div>
                <div className="git-item-actions">
                  <button type="button" className="icon-button icon-button--tiny" title="Open PR">
                    <Icon name="pull" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
