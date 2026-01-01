import { useState } from "react";
import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import { CreateWorktreeDialog } from "../dialogs/CreateWorktreeDialog";
import { DeleteWorktreeDialog } from "../dialogs/DeleteWorktreeDialog";
import type { RepoGroup, RepoHeader, WorktreeItem } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitWorktreesProps = {
  worktreeGroups: RepoGroup<WorktreeItem>[];
  onCreateWorktree?: (repoId: string, branchName: string, path: string) => void;
  onDeleteWorktree?: (repoId: string, branchName: string) => void;
  onOpenTerminal?: (repo: RepoHeader, worktree: WorktreeItem) => void;
  onOpenWorktreeFolder?: (repo: RepoHeader, worktree: WorktreeItem) => void;
  onMergeBranch?: (repoId: string, targetBranch: string, sourceBranch: string) => void;
};

export function GitWorktrees({
  worktreeGroups,
  onCreateWorktree,
  onDeleteWorktree,
  onOpenTerminal,
  onOpenWorktreeFolder,
  onMergeBranch,
}: GitWorktreesProps) {
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    repoId: string;
    repoName: string;
  }>({ open: false, repoId: "", repoName: "" });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    repoId: string;
    branchName: string;
  }>({ open: false, repoId: "", branchName: "" });

  const nodes: TreeNode[] = worktreeGroups.map((group) => {
    const activeBranch = group.repo.activeBranch;
    return {
      id: group.repo.repoId,
      label: group.repo.name,
      description: group.repo.path,
      icon: "folder",
      defaultExpanded: true,
      selectable: false,
      rightSlot: <span className="git-pill">{group.items.length}</span>,
      actions: [
        {
          id: "create-worktree",
          icon: "plus",
          label: "Create Worktree",
        },
      ],
      children: group.items
        .filter((worktree) => worktree.path !== group.repo.path)
        .map((worktree) => ({
          id: `${group.repo.repoId}:${worktree.branch}`,
          label: worktree.branch,
          description: worktree.path,
          icon: "folder",
          contextMenu: [
            {
              id: "merge-to-active",
              label: activeBranch ? `Merge to ${activeBranch}` : "Merge to active branch",
              disabled: !activeBranch || worktree.branch === activeBranch,
            },
          ],
          actions: [
            {
              id: "open-folder",
              icon: "folder",
              label: "Open in File Explorer",
              disabled: !onOpenWorktreeFolder,
            },
            {
              id: "terminal",
              icon: "terminal",
              label: "Terminal",
            },
            {
              id: "delete-worktree",
              icon: "trash",
              label: "Delete",
              intent: "danger",
            },
          ],
        })),
    };
  });

  const handleAction = (node: TreeNode, actionId: string) => {
    if (actionId === "create-worktree") {
      const group = worktreeGroups.find((g) => g.repo.repoId === node.id);
      if (group) {
        setCreateDialog({
          open: true,
          repoId: group.repo.repoId,
          repoName: group.repo.name,
        });
      }
    } else if (
      actionId === "terminal" ||
      actionId === "delete-worktree" ||
      actionId === "open-folder"
    ) {
      // id format: repoId:branchName
      const lastColonIndex = node.id.lastIndexOf(":");
      if (lastColonIndex !== -1) {
        const repoId = node.id.substring(0, lastColonIndex);
        const branchName = node.id.substring(lastColonIndex + 1);
        const group = worktreeGroups.find((g) => g.repo.repoId === repoId);
        const worktree = group?.items.find((item) => item.branch === branchName);
        if (actionId === "terminal") {
          if (group && worktree) {
            onOpenTerminal?.(group.repo, worktree);
          }
          return;
        }
        if (actionId === "open-folder") {
          if (group && worktree) {
            onOpenWorktreeFolder?.(group.repo, worktree);
          }
          return;
        }
        setDeleteDialog({
          open: true,
          repoId,
          branchName,
        });
      }
    }
  };

  const handleContextMenuSelect = (node: TreeNode, itemId: string) => {
    if (itemId !== "merge-to-active") return;
    const lastColonIndex = node.id.lastIndexOf(":");
    if (lastColonIndex === -1) return;
    const repoId = node.id.substring(0, lastColonIndex);
    const branchName = node.id.substring(lastColonIndex + 1);
    const group = worktreeGroups.find((g) => g.repo.repoId === repoId);
    const targetBranch = group?.repo.activeBranch;
    if (targetBranch && targetBranch !== branchName) {
      onMergeBranch?.(repoId, targetBranch, branchName);
    }
  };

  return (
    <div className="git-tree">
      <TreeView
        nodes={nodes}
        toggleOnRowClick
        onAction={handleAction}
        onContextMenuSelect={handleContextMenuSelect}
      />
      {!worktreeGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}

      <CreateWorktreeDialog
        open={createDialog.open}
        repoName={createDialog.repoName}
        onClose={() => setCreateDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={(branchName, path) => {
          onCreateWorktree?.(createDialog.repoId, branchName, path);
        }}
      />

      <DeleteWorktreeDialog
        open={deleteDialog.open}
        branchName={deleteDialog.branchName}
        onClose={() => setDeleteDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={() => {
          onDeleteWorktree?.(deleteDialog.repoId, deleteDialog.branchName);
        }}
      />
    </div>
  );
}
