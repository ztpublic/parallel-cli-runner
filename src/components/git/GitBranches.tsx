import { useState } from "react";
import { Icon } from "../Icons";
import { RepoBranchGroup } from "../../types/git-ui";

type GitBranchesProps = {
  branchGroups: RepoBranchGroup[];
};

export function GitBranches({ branchGroups }: GitBranchesProps) {
  const [expandedRepos, setExpandedRepos] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<
    Record<string, { local: boolean; remote: boolean }>
  >({});

  return (
    <div className="git-tree">
      {branchGroups.map((group) => {
        const repoId = group.repo.repoId;
        const repoExpanded = expandedRepos[repoId] ?? true;
        const sections = expandedSections[repoId] ?? { local: true, remote: true };

        return (
          <div key={repoId} className="git-tree-node">
            <button
              type="button"
              className="git-tree-header"
              onClick={() =>
                setExpandedRepos((prev) => ({
                  ...prev,
                  [repoId]: !(prev[repoId] ?? true),
                }))
              }
            >
              <Icon name={repoExpanded ? "chevronDown" : "chevronRight"} size={14} />
              <Icon name="folder" size={14} />
              <div className="git-tree-title">
                <span>{group.repo.name}</span>
                <span className="git-tree-path">{group.repo.path}</span>
              </div>
              <span className="git-section-spacer" />
              <span className="git-pill">
                {group.localBranches.length + group.remoteBranches.length}
              </span>
            </button>

            {repoExpanded ? (
              <div className="git-tree-children">
                <div className="git-section">
                  <div className="git-section-header">
                    <button
                      type="button"
                      className="git-section-toggle"
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          [repoId]: {
                            local: !sections.local,
                            remote: sections.remote,
                          },
                        }))
                      }
                    >
                      <Icon name={sections.local ? "chevronDown" : "chevronRight"} size={14} />
                      <span>Local Branches</span>
                      <span className="git-section-spacer" />
                      <span className="git-pill">{group.localBranches.length}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--tiny"
                      title="New Branch"
                    >
                      <Icon name="plus" size={12} />
                    </button>
                  </div>
                  {sections.local ? (
                    <div className="git-list git-list--branches">
                      {group.localBranches.map((branch) => (
                        <div
                          key={`${repoId}:${branch.name}`}
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
                            <button
                              type="button"
                              className="icon-button icon-button--tiny"
                              title="Merge"
                            >
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
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          [repoId]: {
                            local: sections.local,
                            remote: !sections.remote,
                          },
                        }))
                      }
                    >
                      <Icon name={sections.remote ? "chevronDown" : "chevronRight"} size={14} />
                      <span>Remote Branches</span>
                      <span className="git-section-spacer" />
                      <span className="git-pill">{group.remoteBranches.length}</span>
                    </button>
                  </div>
                  {sections.remote ? (
                    <div className="git-list git-list--branches">
                      {group.remoteBranches.map((branch) => (
                        <div key={`${repoId}:${branch.name}`} className="git-item">
                          <Icon name="cloud" size={14} />
                          <div className="git-item-body">
                            <div className="git-item-title">
                              <span className="git-item-name">{branch.name}</span>
                            </div>
                            <div className="git-item-meta">{branch.lastCommit}</div>
                          </div>
                          <div className="git-item-actions">
                            <button
                              type="button"
                              className="icon-button icon-button--tiny"
                              title="Open PR"
                            >
                              <Icon name="pull" size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {!branchGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}
    </div>
  );
}
