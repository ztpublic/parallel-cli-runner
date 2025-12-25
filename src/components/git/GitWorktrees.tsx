import { useState } from "react";
import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import { CreateWorktreeDialog } from "../dialogs/CreateWorktreeDialog";
import { DeleteWorktreeDialog } from "../dialogs/DeleteWorktreeDialog";
import type { RepoGroup, WorktreeItem } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitWorktreesProps = {
  worktreeGroups: RepoGroup<WorktreeItem>[];
  onCreateWorktree?: (repoId: string, branchName: string, path: string) => void;
  onDeleteWorktree?: (repoId: string, branchName: string) => void;
};

export function GitWorktrees({
  worktreeGroups,
  onCreateWorktree,
  onDeleteWorktree,
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

  const nodes: TreeNode[] = worktreeGroups.map((group) => ({
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
        actions: [
          {
            id: "open-terminal",
            icon: "terminal",
            label: "Open",
          },
          {
            id: "delete-worktree",
            icon: "trash",
            label: "Delete",
            intent: "danger",
          },
        ],
      })),
  }));

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
    } else if (actionId === "delete-worktree") {
      // id format: repoId:branchName
      const lastColonIndex = node.id.lastIndexOf(":");
      if (lastColonIndex !== -1) {
        const repoId = node.id.substring(0, lastColonIndex);
        const branchName = node.id.substring(lastColonIndex + 1);
        setDeleteDialog({
          open: true,
          repoId,
          branchName,
        });
      }
    }
  };

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} toggleOnRowClick onAction={handleAction} />
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
