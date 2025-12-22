import { useState } from "react";
import { Icon } from "./Icons";

type BranchItem = {
  name: string;
  current?: boolean;
  lastCommit: string;
};

type CommitItem = {
  id: string;
  message: string;
  author: string;
  date: string;
};

type ChangeStatus = "modified" | "added" | "deleted";

type ChangedFile = {
  path: string;
  status: ChangeStatus;
  staged: boolean;
};

const localBranches: BranchItem[] = [
  { name: "main", current: true, lastCommit: "Fix: Update dependencies" },
  { name: "feature/new-ui", lastCommit: "Add workspace overview" },
  { name: "bugfix/terminal-crash", lastCommit: "Stabilize xterm resize" },
];

const remoteBranches: BranchItem[] = [
  { name: "origin/main", lastCommit: "Fix: Update dependencies" },
  { name: "origin/develop", lastCommit: "Merge feature branches" },
];

const commits: CommitItem[] = [
  { id: "a3f8d2e", message: "Fix: Update dependencies", author: "John Doe", date: "2 hours ago" },
  { id: "b7e4c1f", message: "Add workspace overview", author: "Jane Smith", date: "5 hours ago" },
  { id: "c9a2d5b", message: "Stabilize xterm resize", author: "Bob Wilson", date: "1 day ago" },
  { id: "d4f7e8a", message: "Initial commit", author: "John Doe", date: "3 days ago" },
];

const remotes = [
  {
    name: "origin",
    fetch: "https://github.com/user/repo.git",
    push: "https://github.com/user/repo.git",
  },
];

const initialChangedFiles: ChangedFile[] = [
  { path: "src/App.tsx", status: "modified", staged: true },
  { path: "src/components/GitPanel.tsx", status: "modified", staged: true },
  { path: "src/components/TopBar.tsx", status: "added", staged: false },
  { path: "src/services/tauri.ts", status: "modified", staged: false },
  { path: "README.md", status: "deleted", staged: false },
];

export function GitPanel() {
  const [activeTab, setActiveTab] = useState<
    "branches" | "commits" | "commit" | "worktrees" | "remotes"
  >("branches");
  const [expanded, setExpanded] = useState<{ local: boolean; remote: boolean }>({
    local: true,
    remote: true,
  });
  const [commitMessage, setCommitMessage] = useState("");
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>(initialChangedFiles);

  const stagedFiles = changedFiles.filter((file) => file.staged);
  const unstagedFiles = changedFiles.filter((file) => !file.staged);

  const toggleFileStage = (path: string) => {
    setChangedFiles((files) =>
      files.map((file) => (file.path === path ? { ...file, staged: !file.staged } : file))
    );
  };

  const stageAllFiles = () => {
    setChangedFiles((files) => files.map((file) => ({ ...file, staged: true })));
  };

  const unstageAllFiles = () => {
    setChangedFiles((files) => files.map((file) => ({ ...file, staged: false })));
  };

  const generateCommitMessage = () => {
    if (!stagedFiles.length) return;
    const added = stagedFiles.filter((file) => file.status === "added").length;
    const modified = stagedFiles.filter((file) => file.status === "modified").length;
    const deleted = stagedFiles.filter((file) => file.status === "deleted").length;

    const parts: string[] = [];
    if (added) parts.push(`Add ${added} file${added === 1 ? "" : "s"}`);
    if (modified) parts.push(`Update ${modified} file${modified === 1 ? "" : "s"}`);
    if (deleted) parts.push(`Delete ${deleted} file${deleted === 1 ? "" : "s"}`);

    let message = parts.join(", ");
    if (stagedFiles.length <= 3) {
      const fileList = stagedFiles
        .map((file) => file.path.split("/").pop() || file.path)
        .map((name) => `- ${name}`)
        .join("\n");
      message = `${message}\n\n${fileList}`;
    }

    setCommitMessage(message);
  };

  const commitDisabled = !commitMessage.trim() || stagedFiles.length === 0;
  const magicDisabled = stagedFiles.length === 0;

  const getStatusLabel = (status: ChangeStatus) => {
    switch (status) {
      case "added":
        return "A";
      case "deleted":
        return "D";
      default:
        return "M";
    }
  };

  const getStatusIcon = (status: ChangeStatus) => {
    switch (status) {
      case "added":
        return "fileAdd";
      case "deleted":
        return "fileRemove";
      default:
        return "fileEdit";
    }
  };

  return (
    <aside className="git-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Icon name="branch" size={16} />
          <span>Git Manager</span>
        </div>
        <button type="button" className="icon-button icon-button--small" title="Refresh">
          <Icon name="refresh" size={14} />
        </button>
      </div>

      <div className="git-tabs" role="tablist">
        <button
          type="button"
          className={`git-tab ${activeTab === "branches" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "branches"}
          onClick={() => setActiveTab("branches")}
        >
          <Icon name="branch" size={14} />
          <span>Branches</span>
        </button>
        <button
          type="button"
          className={`git-tab ${activeTab === "commits" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "commits"}
          onClick={() => setActiveTab("commits")}
        >
          <Icon name="commit" size={14} />
          <span>Commits</span>
        </button>
        <button
          type="button"
          className={`git-tab ${activeTab === "commit" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "commit"}
          onClick={() => setActiveTab("commit")}
        >
          <Icon name="commit" size={14} />
          <span>Commit</span>
        </button>
        <button
          type="button"
          className={`git-tab ${activeTab === "worktrees" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "worktrees"}
          onClick={() => setActiveTab("worktrees")}
        >
          <Icon name="folder" size={14} />
          <span>Worktrees</span>
        </button>
        <button
          type="button"
          className={`git-tab ${activeTab === "remotes" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "remotes"}
          onClick={() => setActiveTab("remotes")}
        >
          <Icon name="cloud" size={14} />
          <span>Remotes</span>
        </button>
      </div>

      <div className="git-panel-content">
        {activeTab === "branches" ? (
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
                  <span className="git-pill">3</span>
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
                  <span className="git-pill">2</span>
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
        ) : null}

        {activeTab === "commits" ? (
          <div className="git-list">
            {commits.map((commit) => (
              <div key={commit.id} className="git-item">
                <Icon name="commit" size={14} />
                <div className="git-item-body">
                  <div className="git-item-title">
                    <span className="git-item-name">{commit.message}</span>
                    <span className="git-hash">{commit.id}</span>
                  </div>
                  <div className="git-item-meta">
                    <span>{commit.author}</span>
                    <span className="git-dot" />
                    <span>{commit.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === "commit" ? (
          <div className="commit-panel">
            <div className="commit-message">
              <div className="commit-textarea-wrap">
                <textarea
                  id="commit-message"
                  className="commit-textarea"
                  placeholder="Describe your changes..."
                  rows={4}
                  value={commitMessage}
                  onChange={(event) => setCommitMessage(event.target.value)}
                />
                <button
                  type="button"
                  className="commit-magic"
                  onClick={generateCommitMessage}
                  disabled={magicDisabled}
                  title="Generate commit message"
                >
                  <Icon name="sparkle" size={12} />
                </button>
              </div>
              <button type="button" className="commit-button" disabled={commitDisabled}>
                <Icon name="check" size={14} />
                Commit Changes
              </button>
            </div>

            <div className="commit-files">
              {stagedFiles.length ? (
                <div className="commit-section">
                  <div className="commit-section-header">
                    <div className="commit-section-title commit-section-title--staged">Staged</div>
                    <div className="commit-section-count">{stagedFiles.length}</div>
                    <button type="button" className="commit-section-action" onClick={unstageAllFiles}>
                      Unstage All
                    </button>
                  </div>
                  <div className="commit-file-list">
                    {stagedFiles.map((file) => (
                      <div key={file.path} className="commit-file">
                        <Icon
                          name={getStatusIcon(file.status)}
                          size={14}
                          className={`commit-file-icon commit-file-icon--${file.status}`}
                        />
                        <span
                          className={`commit-file-status commit-file-status--${file.status}`}
                        >
                          {getStatusLabel(file.status)}
                        </span>
                        <span className="commit-file-path">{file.path}</span>
                        <button
                          type="button"
                          className="icon-button icon-button--tiny commit-file-action commit-file-action--unstage"
                          title="Unstage file"
                          onClick={() => toggleFileStage(file.path)}
                        >
                          <Icon name="minus" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {unstagedFiles.length ? (
                <div className="commit-section">
                  <div className="commit-section-header">
                    <div className="commit-section-title">Unstaged</div>
                    <div className="commit-section-count">{unstagedFiles.length}</div>
                    <button type="button" className="commit-section-action" onClick={stageAllFiles}>
                      Stage All
                    </button>
                  </div>
                  <div className="commit-file-list">
                    {unstagedFiles.map((file) => (
                      <div key={file.path} className="commit-file">
                        <Icon
                          name={getStatusIcon(file.status)}
                          size={14}
                          className={`commit-file-icon commit-file-icon--${file.status}`}
                        />
                        <span
                          className={`commit-file-status commit-file-status--${file.status}`}
                        >
                          {getStatusLabel(file.status)}
                        </span>
                        <span className="commit-file-path">{file.path}</span>
                        <button
                          type="button"
                          className="icon-button icon-button--tiny commit-file-action commit-file-action--stage"
                          title="Stage file"
                          onClick={() => toggleFileStage(file.path)}
                        >
                          <Icon name="plus" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!stagedFiles.length && !unstagedFiles.length ? (
                <div className="commit-empty">
                  <Icon name="commit" size={22} />
                  <p>Working tree clean.</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === "worktrees" ? (
          <div className="git-empty">
            <Icon name="folder" size={24} />
            <p>No worktrees configured</p>
            <button type="button" className="git-primary-button">
              Add worktree
            </button>
          </div>
        ) : null}

        {activeTab === "remotes" ? (
          <div className="git-list">
            {remotes.map((remote) => (
              <div key={remote.name} className="git-item">
                <Icon name="cloud" size={14} />
                <div className="git-item-body">
                  <div className="git-item-title">
                    <span className="git-item-name">{remote.name}</span>
                  </div>
                  <div className="git-item-meta">Fetch: {remote.fetch}</div>
                  <div className="git-item-meta">Push: {remote.push}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
