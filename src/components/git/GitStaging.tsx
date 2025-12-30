import { useState, useMemo, useEffect } from "react";
import { Icon } from "../Icons";
import { ChangeStatus, ChangedFile, RepoGroup } from "../../types/git-ui";
import { TreeView } from "../TreeView";
import type { TreeNode } from "../../types/tree";

type GitStagingProps = {
  groups: RepoGroup<ChangedFile>[];
  onCommit: (repoId: string, message: string) => void;
  onStageAll: (repoId: string) => void;
  onUnstageAll: (repoId: string) => void;
  onStageFile: (repoId: string, path: string) => void;
  onUnstageFile: (repoId: string, path: string) => void;
  onRollbackFiles: (repoId: string, paths: string[]) => void;
};

export function GitStaging({
  groups,
  onCommit,
  onStageAll,
  onUnstageAll,
  onStageFile,
  onUnstageFile,
  onRollbackFiles,
}: GitStagingProps) {
  const [commitMessage, setCommitMessage] = useState("");
  // By default, check all repos that have staged changes?
  // Or just check all visible repos?
  // Let's default to all dirty groups.
  const [checkedRepoIds, setCheckedRepoIds] = useState<string[]>([]);

  const dirtyGroups = useMemo(() => groups.filter(g => g.items.length > 0), [groups]);

  // Sync checkedRepoIds when dirtyGroups change (e.g. new repo becomes dirty)
  // But we don't want to reset user selection constantly if they uncheck one.
  // Strategy: If a repo is dirty and not in state, add it? 
  // Simple: Just initialize once or when groups length changes drastically?
  // Let's just default to all dirty on mount, and if new ones appear, maybe add them?
  // For now, let's keep it controlled by user, but default to all.
  
  // Actually, simpler: Initialize/Sync.
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
  // Dependency on length is imperfect but avoids infinite loop if we depended on array identity.
  // Better: separate effect for initialization.

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

      const formatDescription = (file: ChangedFile) => {
        if (file.insertions !== undefined && file.deletions !== undefined) {
          const parts = [];
          if (file.insertions > 0) parts.push(`+${file.insertions}`);
          if (file.deletions > 0) parts.push(`-${file.deletions}`);
          if (parts.length === 0) return "No changes"; // e.g. rename only?
          return parts.join(" ");
        }
        return file.status.charAt(0).toUpperCase() + file.status.slice(1);
      };

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
            description: formatDescription(file),
            selectable: true,
            actions: [
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
            description: formatDescription(file),
            selectable: true,
            actions: [
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
        children,
      };
    });
  }, [dirtyGroups]);

  const handleAction = (node: TreeNode, actionId: string) => {
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
        if (actionId === "stage")
          onStageFile(group.repo.repoId, unstagedFile.path);
        if (actionId === "rollback")
          onRollbackFiles(group.repo.repoId, [unstagedFile.path]);
        return;
      }
    }
  };

  const handleCommit = () => {
    // Commit to all checked repos
    checkedRepoIds.forEach(repoId => {
        onCommit(repoId, commitMessage);
    });
    setCommitMessage("");
  };

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
          Commit to {checkedRepoIds.length} {checkedRepoIds.length === 1 ? 'Repo' : 'Repos'}
        </button>
      </div>

      <div className="git-tree">
        <TreeView
            nodes={nodes}
            checkedIds={checkedRepoIds}
            onCheckChange={setCheckedRepoIds}
            onAction={handleAction}
            autoCheckChildren={false} // Only repos are checkable
            toggleOnRowClick={true}
        />
      </div>
    </div>
  );
}
