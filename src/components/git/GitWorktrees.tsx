import { memo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import { ActionMenu } from "../ActionMenu";
import { CreateWorktreeDialog } from "../dialogs/CreateWorktreeDialog";
import { DeleteWorktreeDialog } from "../dialogs/DeleteWorktreeDialog";
import { makeWorktreeTargetId } from "../../hooks/git/gitTargets";
import type { CommitItem, RepoGroup, RepoHeader, WorktreeItem } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

const WorktreeStatusSlot = memo(function WorktreeStatusSlot({
  isAhead,
  isBehind,
  ahead,
  behind,
}: {
  isAhead: boolean;
  isBehind: boolean;
  ahead?: number;
  behind?: number;
}) {
  return (isAhead || isBehind) ? (
    <span className="git-branch-status text-xs text-muted">
      {isBehind ? `↓${behind} ` : ""}
      {isAhead ? `↑${ahead}` : ""}
    </span>
  ) : null;
});

WorktreeStatusSlot.displayName = 'WorktreeStatusSlot';

type GitWorktreesProps = {
  worktreeGroups: RepoGroup<WorktreeItem>[];
  commitsByRepo?: Record<string, Record<string, CommitItem[]>>;
  isLoadingCommits?: (repoId: string, worktreePath: string) => boolean;
  onCreateWorktree?: (repoId: string, branchName: string, path: string) => void;
  onDeleteWorktree?: (repoId: string, branchName: string) => void;
  onOpenTerminal?: (repo: RepoHeader, worktree: WorktreeItem) => void;
  onOpenWorktreeFolder?: (repo: RepoHeader, worktree: WorktreeItem) => void;
  onOpenAgent?: (repo: RepoHeader, worktree: WorktreeItem) => void;
  onMergeBranch?: (repoId: string, targetBranch: string, sourceBranch: string) => void;
  onRebaseBranch?: (repoId: string, targetBranch: string, ontoBranch: string) => void;
  onSmartUpdateWorktrees?: (repoId: string) => void;
};

export const GitWorktrees = memo(function GitWorktrees({
  worktreeGroups,
  commitsByRepo,
  isLoadingCommits,
  onCreateWorktree,
  onDeleteWorktree,
  onOpenTerminal,
  onOpenWorktreeFolder,
  onOpenAgent,
  onMergeBranch,
  onRebaseBranch,
  onSmartUpdateWorktrees,
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

  const [actionMenu, setActionMenu] = useState<{
    node: TreeNode;
    position: { x: number; y: number };
  } | null>(null);

  const nodes: TreeNode[] = worktreeGroups.map((group) => {
    const activeBranch = group.repo.activeBranch;
    const worktrees = group.items.filter((worktree) => worktree.path !== group.repo.path);

    return {
      id: group.repo.repoId,
      label: group.repo.name,
      description: group.repo.path,
      icon: "folder",
      defaultExpanded: true,
      selectable: false,
      rightSlot: <span className="git-pill">{worktrees.length}</span>,
      actions: [
        {
          id: "create-worktree",
          icon: "plus",
          label: "Create Worktree",
        },
      ],
      contextMenu: [
        {
          id: "smart-update-worktrees",
          label: activeBranch
            ? `Smart update worktrees to ${activeBranch}`
            : "Smart update worktrees",
          disabled: !activeBranch || !worktrees.length || !onSmartUpdateWorktrees,
        },
        {
          id: "rebase-all-on-active",
          label: activeBranch
            ? `Rebase all on ${activeBranch}`
            : "Rebase all on active branch",
          disabled: !activeBranch || !worktrees.length || !onRebaseBranch,
        },
      ],
      children: worktrees.map((worktree) => {
          const isAhead = (worktree.ahead ?? 0) > 0;
          const isBehind = (worktree.behind ?? 0) > 0;
          const hasStatus = isAhead || isBehind;
          const rightSlot = hasStatus ? (
            <span className="git-branch-status text-xs text-muted">
              {isBehind ? `↓${worktree.behind} ` : ""}
              {isAhead ? `↑${worktree.ahead}` : ""}
            </span>
          ) : null;

          const worktreeCommits = commitsByRepo?.[group.repo.repoId]?.[worktree.path] ?? [];
          const isLoading = isLoadingCommits?.(group.repo.repoId, worktree.path) ?? false;

          const commitNodes: TreeNode[] = worktreeCommits.map((commit) => ({
            id: `${group.repo.repoId}:${worktree.path}:${commit.id}`,
            label: commit.message,
            description: `${commit.author} - ${commit.date}`,
            icon: "commit",
            selectable: false,
          }));

          return {
            id: `${group.repo.repoId}:${worktree.branch}`,
            label: worktree.branch,
            description: worktree.path,
            icon: "folder",
            rightSlot,
            contextMenu: [
            {
              id: "separator-update-worktree",
              label: "Update work tree",
              type: "separator",
            },
            {
              id: "update-from-active",
              label: activeBranch ? `Merge from ${activeBranch}` : "Merge from active branch",
              disabled: !activeBranch || worktree.branch === activeBranch,
            },
            {
              id: "rebase-branch-on-active",
              label: activeBranch
                ? `Rebase ${worktree.branch} on ${activeBranch}`
                : `Rebase ${worktree.branch} on active branch`,
              disabled: !activeBranch || worktree.branch === activeBranch,
            },
            {
              id: "separator-update-repo",
              label: "Update repo",
              type: "separator",
            },
            {
              id: "merge-to-active",
              label: activeBranch ? `Merge to ${activeBranch}` : "Merge to active branch",
              disabled: !activeBranch || worktree.branch === activeBranch,
            },
            {
              id: "rebase-active-on-branch",
              label: activeBranch
                ? `Rebase ${activeBranch} on ${worktree.branch}`
                : `Rebase active branch on ${worktree.branch}`,
              disabled: !activeBranch || worktree.branch === activeBranch,
            },
            ],
            actions: [
            {
              id: "open",
              icon: "plus",
              label: "Open",
            },
            {
              id: "delete-worktree",
              icon: "trash",
              label: "Delete",
              intent: "danger",
            },
            ],
            children: commitNodes.length > 0 || isLoading ? commitNodes : undefined,
          };
        }),
    };
  });

  const handleAction = (node: TreeNode, actionId: string, event?: ReactMouseEvent) => {
    if (actionId === "create-worktree") {
      const group = worktreeGroups.find((g) => g.repo.repoId === node.id);
      if (group) {
        setCreateDialog({
          open: true,
          repoId: group.repo.repoId,
          repoName: group.repo.name,
        });
      }
      return;
    }

    if (actionId === "delete-worktree") {
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
      return;
    }

    if (actionId === "open") {
      // Show the action menu
      if (event) {
        const buttonElement = event.currentTarget;
        const rect = buttonElement.getBoundingClientRect();
        setActionMenu({
          node,
          position: {
            x: rect.left,
            y: rect.bottom + 4,
          },
        });
      }
      return;
    }

    // Handle menu actions: open-folder, terminal, open-agent
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

      if (actionId === "open-agent") {
        if (group && worktree) {
          onOpenAgent?.(group.repo, worktree);
        }
        return;
      }
    }
  };

  const handleContextMenuSelect = async (node: TreeNode, itemId: string) => {
    const repoGroup = worktreeGroups.find((group) => group.repo.repoId === node.id);
    if (repoGroup) {
      const activeBranch = repoGroup.repo.activeBranch;
      if (itemId === "smart-update-worktrees") {
        onSmartUpdateWorktrees?.(repoGroup.repo.repoId);
      } else if (itemId === "rebase-all-on-active" && activeBranch) {
        // Rebase all worktree branches on the active branch sequentially
        const worktrees = repoGroup.items.filter((worktree) => worktree.path !== repoGroup.repo.path);
        for (const worktree of worktrees) {
          if (worktree.branch !== activeBranch) {
            const worktreeTargetId = makeWorktreeTargetId(repoGroup.repo.repoId, worktree.path);
            await onRebaseBranch?.(worktreeTargetId, worktree.branch, activeBranch);
          }
        }
      }
      return;
    }
    const lastColonIndex = node.id.lastIndexOf(":");
    if (lastColonIndex === -1) return;
    const repoId = node.id.substring(0, lastColonIndex);
    const branchName = node.id.substring(lastColonIndex + 1);
    const group = worktreeGroups.find((g) => g.repo.repoId === repoId);
    const targetBranch = group?.repo.activeBranch;
    if (!targetBranch || targetBranch === branchName) return;
    if (itemId === "merge-to-active") {
      onMergeBranch?.(repoId, targetBranch, branchName);
      return;
    }
    if (itemId === "update-from-active") {
      onMergeBranch?.(repoId, branchName, targetBranch);
      return;
    }
    if (itemId === "rebase-branch-on-active") {
      onRebaseBranch?.(repoId, branchName, targetBranch);
      return;
    }
    if (itemId === "rebase-active-on-branch") {
      onRebaseBranch?.(repoId, targetBranch, branchName);
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

      {actionMenu ? (
        <ActionMenu
          items={[
            { id: "open-folder", icon: "folder", label: "Open in File Explorer" },
            { id: "terminal", icon: "terminal", label: "Terminal" },
            { id: "open-agent", icon: "robot", label: "Open Agent" },
          ]}
          position={actionMenu.position}
          onSelect={(itemId) => {
            handleAction(actionMenu.node, itemId);
            setActionMenu(null);
          }}
          onClose={() => setActionMenu(null)}
        />
      ) : null}
    </div>
  );
});

GitWorktrees.displayName = 'GitWorktrees';
