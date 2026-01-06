import { memo, useState, useMemo, useEffect, useCallback } from "react";
import { openFileInEditor } from "../../platform/actions";
import { Icon } from "../Icons";
import { ChangeStatus, ChangedFile, RepoGroup } from "../../types/git-ui";
import { TreeView } from "../TreeView";
import { StashChangesDialog } from "../dialogs/StashChangesDialog";
import type { TreeNode } from "../../types/tree";

const FileDescription = memo(function FileDescription({
  insertions,
  deletions,
  status,
}: {
  insertions?: number;
  deletions?: number;
  status: ChangeStatus;
}) {
  if (insertions !== undefined && deletions !== undefined) {
    const parts = [];
    if (insertions > 0) {
      parts.push(
        <span key="ins" style={{ color: "#73c991", marginRight: deletions > 0 ? "4px" : "0" }}>
          +{insertions}
        </span>
      );
    }
    if (deletions > 0) {
      parts.push(
        <span key="del" style={{ color: "#f48771" }}>
          -{deletions}
        </span>
      );
    }
    if (parts.length === 0) return "No changes";
    return <>{parts}</>;
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
});

FileDescription.displayName = 'FileDescription';

type GitStagingProps = {
  groups: RepoGroup<ChangedFile>[];
  onCommit: (repoId: string, message: string) => Promise<any> | void;
  onStageAll: (repoId: string) => Promise<any> | void;
  onUnstageAll: (repoId: string) => void;
  onStageFile: (repoId: string, path: string) => void;
  onUnstageFile: (repoId: string, path: string) => void;
  onRollbackFiles: (repoId: string, paths: string[]) => void;
  onStash: (repoId: string, message: string) => void;
};

export const GitStaging = memo(function GitStaging({
  groups,
  onCommit,
  onStageAll,
  onUnstageAll,
  onStageFile,
  onUnstageFile,
  onRollbackFiles,
  onStash,
}: GitStagingProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [checkedRepoIds, setCheckedRepoIds] = useState<string[]>([]);
  const [stashDialog, setStashDialog] = useState<{
    open: boolean;
    repoId: string | null;
  }>({ open: false, repoId: null });

  const dirtyGroups = useMemo(() => groups.filter(g => g.items.length > 0), [groups]);

  // Sync checkedRepoIds when dirtyGroups change (e.g. new repo becomes dirty)
  useEffect(() => {
    setCheckedRepoIds(prev => {
        const currentIds = new Set(dirtyGroups.map(g => g.repo.repoId));
        // Keep existing that are still dirty
        const next = prev.filter(id => currentIds.has(id));
        // Add new dirty ones that weren't there?
        // Let's just set to all dirty ones if list was empty (first load)?
        if (prev.length === 0 && dirtyGroups.length > 0) {
            return dirtyGroups.map(g => g.repo.repoId);
        }
        return next;
    });
  }, [dirtyGroups.length]); 

  const getStatusIcon = (status: ChangeStatus) => {
    switch (status) {
      case "added": return "fileAdd";
      case "deleted": return "fileRemove";
      default: return "fileEdit";
    }
  };

  const getIconClass = (status: ChangeStatus) => {
    switch (status) {
      case "added": return "tree-node-icon--added";
      case "deleted": return "tree-node-icon--deleted";
      default: return "tree-node-icon--modified";
    }
  };

  const nodes = useMemo<TreeNode[]>(() => {
    return dirtyGroups.map(group => {
      const stagedFiles = group.items.filter(f => f.staged);
      const unstagedFiles = group.items.filter(f => !f.staged);

      const children: TreeNode[] = [];

      if (stagedFiles.length > 0) {
        children.push({
          id: `repo:${group.repo.repoId}:staged`,
          label: "Staged Changes",
          icon: "check",
          defaultExpanded: true,
          selectable: false,
          rightSlot: <span className="git-pill">{stagedFiles.length}</span>,
          actions: [
            { id: "unstage-all", icon: "minus", label: "Unstage All" },
            { id: "rollback-all", icon: "undo", label: "Roll back All", intent: "danger" },
          ],
          children: stagedFiles.map(file => ({
            id: `file:${group.repo.repoId}:${file.path}:staged`,
            label: file.path,
            icon: getStatusIcon(file.status),
            iconClassName: getIconClass(file.status),
            description: (
              <FileDescription
                insertions={file.insertions}
                deletions={file.deletions}
                status={file.status}
              />
            ),
            selectable: true,
            actions: [
              { id: "open-file", icon: "externalLink", label: "Open in VSCode" },
              { id: "unstage", icon: "minus", label: "Unstage" },
              { id: "rollback", icon: "undo", label: "Roll back", intent: "danger" },
            ],
          })),
        });
      }

      if (unstagedFiles.length > 0) {
        children.push({
          id: `repo:${group.repo.repoId}:unstaged`,
          label: "Unstaged Changes",
          icon: "fileEdit",
          defaultExpanded: true,
          selectable: false,
          rightSlot: <span className="git-pill">{unstagedFiles.length}</span>,
          actions: [
            { id: "stage-all", icon: "plus", label: "Stage All" },
            { id: "rollback-all", icon: "undo", label: "Roll back All", intent: "danger" },
          ],
          children: unstagedFiles.map(file => ({
            id: `file:${group.repo.repoId}:${file.path}:unstaged`,
            label: file.path,
            icon: getStatusIcon(file.status),
            iconClassName: getIconClass(file.status),
            description: (
              <FileDescription
                insertions={file.insertions}
                deletions={file.deletions}
                status={file.status}
              />
            ),
            selectable: true,
            actions: [
              { id: "open-file", icon: "externalLink", label: "Open in VSCode" },
              { id: "stage", icon: "plus", label: "Stage" },
              { id: "rollback", icon: "undo", label: "Roll back", intent: "danger" },
            ],
          })),
        });
      }

      return {
        id: group.repo.repoId, // The repoId is the node ID for checking
        label: group.repo.name,
        description: group.repo.activeBranch
          ? `${group.repo.activeBranch} • ${group.repo.path}`
          : group.repo.path,
        icon: "folder",
        checkable: true, // Only repo is checkable for multi-commit
        defaultExpanded: true,
        selectable: false,
        rightSlot: <span className="git-pill">{group.items.length}</span>,
        contextMenu: [
          { id: "stash-all", label: "Stash All Changes", icon: "archive" },
        ],
        children,
      };
    });
  }, [dirtyGroups]);

  const handleAction = useCallback((node: TreeNode, actionId: string) => {
    // Find repo group based on node ID structure
    for (const group of dirtyGroups) {
      if (node.id === `repo:${group.repo.repoId}:staged`) {
        if (actionId === "unstage-all") onUnstageAll(group.repo.repoId);
        if (actionId === "rollback-all") {
          const paths = group.items.filter((file) => file.staged).map((file) => file.path);
          onRollbackFiles(group.repo.repoId, paths);
        }
        return;
      }
      if (node.id === `repo:${group.repo.repoId}:unstaged`) {
        if (actionId === "stage-all") onStageAll(group.repo.repoId);
        if (actionId === "rollback-all") {
          const paths = group.items.filter((file) => !file.staged).map((file) => file.path);
          onRollbackFiles(group.repo.repoId, paths);
        }
        return;
      }

      // Check files
      // Staged
      const stagedFile = group.items.find(
        (f) =>
          f.staged &&
          `file:${group.repo.repoId}:${f.path}:staged` === node.id
      );
      if (stagedFile) {
        if (actionId === "open-file") {
          const fullPath = `${group.repo.path}/${stagedFile.path}`;
          openFileInEditor(fullPath);
        }
        if (actionId === "unstage")
          onUnstageFile(group.repo.repoId, stagedFile.path);
        if (actionId === "rollback")
          onRollbackFiles(group.repo.repoId, [stagedFile.path]);
        return;
      }
      // Unstaged
      const unstagedFile = group.items.find(
        (f) =>
          !f.staged &&
          `file:${group.repo.repoId}:${f.path}:unstaged` === node.id
      );
      if (unstagedFile) {
        if (actionId === "open-file") {
          const fullPath = `${group.repo.path}/${unstagedFile.path}`;
          openFileInEditor(fullPath);
        }
        if (actionId === "stage")
          onStageFile(group.repo.repoId, unstagedFile.path);
        if (actionId === "rollback")
          onRollbackFiles(group.repo.repoId, [unstagedFile.path]);
        return;
      }
    }
  }, [dirtyGroups, onUnstageAll, onRollbackFiles, onStageFile, onUnstageFile, openFileInEditor]);

  const handleContextMenuSelect = useCallback((node: TreeNode, itemId: string) => {
    if (itemId === "stash-all") {
      setStashDialog({ open: true, repoId: node.id });
    }
  }, []);

  const handleConfirmStash = useCallback((message: string) => {
    if (stashDialog.repoId) {
      onStash(stashDialog.repoId, message);
    }
  }, [stashDialog, onStash]);

  const handleCommit = useCallback(async () => {
    // Check for repos that are checked but have no staged files and have unstaged files
    const reposToStage: string[] = [];

    checkedRepoIds.forEach(repoId => {
      const group = groups.find(g => g.repo.repoId === repoId);
      if (group) {
        const hasStaged = group.items.some(f => f.staged);
        const hasUnstaged = group.items.some(f => !f.staged);
        if (!hasStaged && hasUnstaged) {
          reposToStage.push(repoId);
        }
      }
    });

    // Auto-stage all for repos that need it
    await Promise.all(reposToStage.map(id => onStageAll(id)));

    // Commit to all checked repos
    await Promise.all(checkedRepoIds.map(repoId => onCommit(repoId, commitMessage)));
    setCommitMessage("");
  }, [checkedRepoIds, groups, commitMessage, onStageAll, onCommit]);

  const commitButtonText = useMemo(() => {
    if (checkedRepoIds.length === 1) {
      const repoId = checkedRepoIds[0];
      const group = groups.find((g) => g.repo.repoId === repoId);
      if (group) {
        const branch = group.repo.activeBranch;
        return `Commit to ${group.repo.name}${branch ? ` - ${branch}` : ""}`;
      }
    }
    return `Commit to ${checkedRepoIds.length} ${
      checkedRepoIds.length === 1 ? "Repo" : "Repos"
    }`;
  }, [checkedRepoIds, groups]);

  const commitDisabled = !commitMessage.trim() || checkedRepoIds.length === 0;

  if (!dirtyGroups.length) {
    return (
      <div className="git-empty">
        <Icon name="check" size={22} />
        <p>All repositories clean.</p>
      </div>
    );
  }

  return (
    <div className="commit-panel">
      <div className="commit-message">
        <div className="commit-textarea-wrap">
          <textarea
            className="commit-textarea"
            placeholder="Describe your changes..."
            rows={3}
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          className="commit-button"
          disabled={commitDisabled}
          onClick={handleCommit}
        >
          <Icon name="check" size={14} />
          {commitButtonText}
        </button>
      </div>

      <div className="git-tree">
        <TreeView
            nodes={nodes}
            checkedIds={checkedRepoIds}
            onCheckChange={setCheckedRepoIds}
            onAction={handleAction}
            onContextMenuSelect={handleContextMenuSelect}
            autoCheckChildren={false} // Only repos are checkable
            toggleOnRowClick={true}
        />
      </div>

      <StashChangesDialog
        open={stashDialog.open}
        onClose={() => setStashDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleConfirmStash}
      />
    </div>
  );
});

GitStaging.displayName = 'GitStaging';

