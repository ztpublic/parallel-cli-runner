import { useState } from "react";
import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import { ResetDialog } from "../dialogs/ResetDialog";
import { RevertDialog } from "../dialogs/RevertDialog";
import type { CommitItem, RepoGroup } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitCommitsProps = {
  commitGroups: RepoGroup<CommitItem>[];
  onLoadMore?: (repoId: string) => void;
  canLoadMore?: (repoId: string) => boolean;
  isLoadingMore?: (repoId: string) => boolean;
  onReset?: (repoId: string, commitId: string, mode: "soft" | "mixed" | "hard") => void;
  onRevert?: (repoId: string, commitId: string) => void;
};

export function GitCommits({
  commitGroups,
  onLoadMore,
  canLoadMore,
  isLoadingMore,
  onReset,
  onRevert,
}: GitCommitsProps) {
  const [resetDialog, setResetDialog] = useState<{
    open: boolean;
    repoId: string;
    commitId: string;
  }>({ open: false, repoId: "", commitId: "" });

  const [revertDialog, setRevertDialog] = useState<{
    open: boolean;
    repoId: string;
    commitId: string;
  }>({ open: false, repoId: "", commitId: "" });

  const nodes: TreeNode[] = commitGroups.map((group) => {
    const children: TreeNode[] = group.items.map((commit) => ({
      id: `${group.repo.repoId}:${commit.id}`,
      label: commit.message,
      description: `${commit.author} - ${commit.date}`,
      icon: "commit",
      contextMenu: [
        {
          id: "reset",
          label: "Reset...",
        },
        {
          id: "revert",
          label: "Revert...",
        },
      ],
    }));

    if (canLoadMore?.(group.repo.repoId)) {
      children.push({
        id: `${group.repo.repoId}:load-more-commits`,
        label: "Load More...",
        variant: "load-more",
        isLoading: isLoadingMore?.(group.repo.repoId),
        selectable: false,
      });
    }

    return {
      id: group.repo.repoId,
      label: group.repo.name,
      description: group.repo.activeBranch
        ? `${group.repo.activeBranch} • ${group.repo.path}`
        : group.repo.path,
      icon: "folder",
      defaultExpanded: true,
      selectable: false,
      rightSlot: <span className="git-pill">{group.items.length}</span>,
      children,
    };
  });

  const handleNodeActivate = (node: TreeNode) => {
    if (node.id.endsWith(":load-more-commits")) {
      const repoId = node.id.replace(":load-more-commits", "");
      onLoadMore?.(repoId);
    }
  };

  const handleContextMenuSelect = (node: TreeNode, itemId: string) => {
    // Node ID format: repoId:commitId
    const lastColonIndex = node.id.lastIndexOf(":");
    if (lastColonIndex === -1) return;
    
    const repoId = node.id.substring(0, lastColonIndex);
    const commitId = node.id.substring(lastColonIndex + 1);

    if (itemId === "reset") {
      setResetDialog({ open: true, repoId, commitId });
    } else if (itemId === "revert") {
      setRevertDialog({ open: true, repoId, commitId });
    }
  };

  return (
    <div className="git-tree">
      <TreeView
        nodes={nodes}
        toggleOnRowClick
        onNodeActivate={handleNodeActivate}
        onContextMenuSelect={handleContextMenuSelect}
      />
      {!commitGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}

      <ResetDialog
        open={resetDialog.open}
        commitHash={resetDialog.commitId}
        onClose={() => setResetDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={(mode) => {
          onReset?.(resetDialog.repoId, resetDialog.commitId, mode);
        }}
      />

      <RevertDialog
        open={revertDialog.open}
        commitHash={revertDialog.commitId}
        onClose={() => setRevertDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={() => {
          onRevert?.(revertDialog.repoId, revertDialog.commitId);
        }}
      />
    </div>
  );
}
