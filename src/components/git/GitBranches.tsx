import { memo, useMemo, useCallback, useState } from "react";
import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import { CreateBranchDialog } from "../dialogs/CreateBranchDialog";
import { DeleteBranchDialog } from "../dialogs/DeleteBranchDialog";
import { ForcePushDialog } from "../dialogs/ForcePushDialog";
import { CreateWorktreeFromBranchDialog } from "../dialogs/CreateWorktreeFromBranchDialog";
import type { RepoBranchGroup } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

const BranchStatusSlot = memo(function BranchStatusSlot({
  isCurrent,
  isAhead,
  isBehind,
  ahead,
  behind,
}: {
  isCurrent: boolean;
  isAhead: boolean;
  isBehind: boolean;
  ahead?: number;
  behind?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {isCurrent && <span className="git-badge">current</span>}
      {(isAhead || isBehind) ? (
        <span className="git-branch-status text-xs text-muted">
          {isBehind ? `↓${behind} ` : ""}
          {isAhead ? `↑${ahead}` : ""}
        </span>
      ) : null}
    </div>
  );
});

BranchStatusSlot.displayName = 'BranchStatusSlot';

type GitBranchesProps = {
  branchGroups: RepoBranchGroup[];
  onLoadMoreLocal?: (repoId: string) => void;
  onLoadMoreRemote?: (repoId: string) => void;
  canLoadMoreLocal?: (repoId: string) => boolean;
  canLoadMoreRemote?: (repoId: string) => boolean;
  onCreateBranch?: (repoId: string, name: string, sourceBranch?: string) => void;
  onSwitchBranch?: (repoId: string, branchName: string) => void;
  onDeleteBranch?: (repoId: string, branchName: string) => void;
  onMergeBranch?: (repoId: string, targetBranch: string, sourceBranch: string) => void;
  onRebaseBranch?: (repoId: string, targetBranch: string, ontoBranch: string) => void;
  onPull?: (repoId: string) => void;
  onPush?: (repoId: string, force: boolean) => void;
  onCreateWorktreeForBranch?: (repoId: string, branchName: string, path: string) => void;
};

export const GitBranches = memo(function GitBranches({
  branchGroups,
  onLoadMoreLocal,
  onLoadMoreRemote,
  canLoadMoreLocal,
  canLoadMoreRemote,
  onCreateBranch,
  onSwitchBranch,
  onDeleteBranch,
  onMergeBranch,
  onRebaseBranch,
  onPull,
  onPush,
  onCreateWorktreeForBranch,
}: GitBranchesProps) {
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    repoId: string;
    sourceBranch?: string;
  }>({ open: false, repoId: "" });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    repoId: string;
    branchName: string;
  }>({ open: false, repoId: "", branchName: "" });

  const [forcePushDialog, setForcePushDialog] = useState<{
    open: boolean;
    repoId: string;
    branchName: string;
  }>({ open: false, repoId: "", branchName: "" });

  const [createWorktreeDialog, setCreateWorktreeDialog] = useState<{
    open: boolean;
    repoId: string;
    repoName: string;
    branchName: string;
  }>({ open: false, repoId: "", repoName: "", branchName: "" });

  const createBranchNodes = useCallback((group: RepoBranchGroup): TreeNode[] => {
    const activeBranch = group.repo.activeBranch;
    return group.localBranches.map((branch) => {
      const isAhead = (branch.ahead ?? 0) > 0;
      const isBehind = (branch.behind ?? 0) > 0;

      return {
        id: `${group.repo.repoId}:local:${branch.name}`,
        label: branch.name,
        description: branch.lastCommit,
        icon: "branch",
        rightSlot: (
          <BranchStatusSlot
            isCurrent={branch.current ?? false}
            isAhead={isAhead}
            isBehind={isBehind}
            ahead={branch.ahead}
            behind={branch.behind}
          />
        ),
        contextMenu: [
          {
            id: "switch-branch",
            label: "Switch Branch",
            disabled: branch.current,
          },
          {
            id: "merge-to-active",
            label: activeBranch ? `Merge to ${activeBranch}` : "Merge to active branch",
            disabled: !activeBranch || branch.current,
          },
          {
            id: "rebase-active-on-branch",
            label: activeBranch
              ? `Rebase ${activeBranch} on ${branch.name}`
              : `Rebase active branch on ${branch.name}`,
            disabled: !activeBranch || branch.current,
          },
          {
            id: "pull",
            label: "Pull",
            disabled: !branch.current,
          },
          {
            id: "push",
            label: "Push",
            disabled: !branch.current,
          },
          {
            id: "force-push",
            label: "Force Push",
            disabled: !branch.current,
          },
          {
            id: "create-worktree",
            label: "Create worktree",
          },
        ],
        actions: [
          {
            id: "delete",
            icon: "trash",
            label: "Delete",
            intent: "danger",
            disabled: branch.current,
          },
        ],
      };
    });
  }, []);

  const nodes: TreeNode[] = useMemo(() => {
    return branchGroups.map((group) => {
      const localChildren = createBranchNodes(group);

      if (canLoadMoreLocal?.(group.repo.repoId)) {
        localChildren.push({
          id: `${group.repo.repoId}:local:load-more`,
          label: "Load More...",
          variant: "load-more",
          selectable: false,
        });
      }

      const remoteChildren: TreeNode[] = group.remoteBranches.map((branch) => ({
        id: `${group.repo.repoId}:remote:${branch.name}`,
        label: branch.name,
        description: branch.lastCommit,
        icon: "cloud",
        actions: [],
      }));

      if (canLoadMoreRemote?.(group.repo.repoId)) {
        remoteChildren.push({
          id: `${group.repo.repoId}:remote:load-more`,
          label: "Load More...",
          variant: "load-more",
          selectable: false,
        });
      }

      return {
        id: group.repo.repoId,
        label: group.repo.name,
        description: group.repo.path,
        icon: "folder",
        defaultExpanded: true,
        selectable: false,
        rightSlot: (
          <span className="git-pill">
            {group.localBranches.length + group.remoteBranches.length}
          </span>
        ),
        children: [
          {
            id: `${group.repo.repoId}:local`,
            label: "Local Branches",
            icon: "branch",
            defaultExpanded: true,
            selectable: false,
            rightSlot: <span className="git-pill">{group.localBranches.length}</span>,
            actions: [
              {
                id: "new-branch",
                icon: "plus",
                label: "New Branch",
              },
            ],
            children: localChildren,
          },
          {
            id: `${group.repo.repoId}:remote`,
            label: "Remote Branches",
            icon: "cloud",
            defaultExpanded: false,
            selectable: false,
            rightSlot: <span className="git-pill">{group.remoteBranches.length}</span>,
            children: remoteChildren,
          },
        ],
      };
    });
  }, [branchGroups, canLoadMoreLocal, canLoadMoreRemote, createBranchNodes]);

  const handleNodeActivate = useCallback((node: TreeNode) => {
    if (node.id.endsWith(":local:load-more")) {
      const repoId = node.id.replace(":local:load-more", "");
      onLoadMoreLocal?.(repoId);
    } else if (node.id.endsWith(":remote:load-more")) {
      const repoId = node.id.replace(":remote:load-more", "");
      onLoadMoreRemote?.(repoId);
    }
  }, [onLoadMoreLocal, onLoadMoreRemote]);

  const handleAction = useCallback((node: TreeNode, actionId: string) => {
    if (actionId === "new-branch") {
      const repoId = node.id.replace(":local", "");
      // Find the current branch for this repo
      const group = branchGroups.find((g) => g.repo.repoId === repoId);
      const currentBranch = group?.localBranches.find((b) => b.current)?.name;
      
      setCreateDialog({
        open: true,
        repoId,
        sourceBranch: currentBranch,
      });
    } else if (actionId === "delete") {
      const parts = node.id.split(":local:");
      if (parts.length === 2) {
        const repoId = parts[0];
        const branchName = parts[1];
        setDeleteDialog({
          open: true,
          repoId,
          branchName,
        });
      }
    }
  }, [branchGroups]);

  const handleContextMenuSelect = useCallback((node: TreeNode, itemId: string) => {
    if (itemId === "switch-branch") {
      // id format: repoId:local:branchName
      // We need to parse it carefully because repoId can contain colons?
      // Actually, standard IDs here are constructed as `${group.repo.repoId}:local:${branch.name}`.
      // A safer way is to find the group and branch from the node structure or ID if we assume structure.
      // But passing repoId and branchName in context or parsing ID is common.
      // Let's rely on the structure we built: last part is branch name, prefix is repoId:local
      
      const parts = node.id.split(":local:");
      if (parts.length === 2) {
        const repoId = parts[0];
        const branchName = parts[1];
        onSwitchBranch?.(repoId, branchName);
      }
    } else if (itemId === "merge-to-active") {
      const parts = node.id.split(":local:");
      if (parts.length === 2) {
        const repoId = parts[0];
        const branchName = parts[1];
        const group = branchGroups.find((g) => g.repo.repoId === repoId);
        const targetBranch = group?.repo.activeBranch;
        if (targetBranch && targetBranch !== branchName) {
          onMergeBranch?.(repoId, targetBranch, branchName);
        }
      }
    } else if (itemId === "rebase-active-on-branch") {
      const parts = node.id.split(":local:");
      if (parts.length === 2) {
        const repoId = parts[0];
        const branchName = parts[1];
        const group = branchGroups.find((g) => g.repo.repoId === repoId);
        const targetBranch = group?.repo.activeBranch;
        if (targetBranch && targetBranch !== branchName) {
          onRebaseBranch?.(repoId, targetBranch, branchName);
        }
      }
    } else if (itemId === "pull") {
      const parts = node.id.split(":local:");
      if (parts.length === 2) {
        const repoId = parts[0];
        // branchName is not needed for pull as it pulls current branch, 
        // but we verify it's the right node.
        onPull?.(repoId);
      }
    } else if (itemId === "push") {
      const parts = node.id.split(":local:");
      if (parts.length === 2) {
        const repoId = parts[0];
        onPush?.(repoId, false);
      }
    } else if (itemId === "force-push") {
      const parts = node.id.split(":local:");
      if (parts.length === 2) {
        const repoId = parts[0];
        const branchName = parts[1];
        setForcePushDialog({ open: true, repoId, branchName });
      }
    } else if (itemId === "create-worktree") {
      const parts = node.id.split(":local:");
      if (parts.length === 2) {
        const repoId = parts[0];
        const branchName = parts[1];
        const group = branchGroups.find((g) => g.repo.repoId === repoId);
        const repoName = group?.repo.name ?? repoId;
          setCreateWorktreeDialog({ open: true, repoId, repoName, branchName });
      }
    }
  }, [branchGroups, onSwitchBranch, onMergeBranch, onRebaseBranch, onPull, onPush]);

  return (
    <div className="git-tree">
      <TreeView
        nodes={nodes}
        toggleOnRowClick
        onNodeActivate={handleNodeActivate}
        onAction={handleAction}
        onContextMenuSelect={handleContextMenuSelect}
      />
      {!branchGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}

      <CreateBranchDialog
        open={createDialog.open}
        sourceBranch={createDialog.sourceBranch}
        onClose={() => setCreateDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={(name) => {
          onCreateBranch?.(createDialog.repoId, name, createDialog.sourceBranch);
        }}
      />

      <DeleteBranchDialog
        open={deleteDialog.open}
        branchName={deleteDialog.branchName}
        onClose={() => setDeleteDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={() => {
          onDeleteBranch?.(deleteDialog.repoId, deleteDialog.branchName);
        }}
      />

      <ForcePushDialog
        open={forcePushDialog.open}
        branchName={forcePushDialog.branchName}
        onClose={() => setForcePushDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={() => {
          onPush?.(forcePushDialog.repoId, true);
        }}
      />

      <CreateWorktreeFromBranchDialog
        open={createWorktreeDialog.open}
        repoName={createWorktreeDialog.repoName}
        branchName={createWorktreeDialog.branchName}
        onClose={() => setCreateWorktreeDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={(branchName, path) => {
          onCreateWorktreeForBranch?.(createWorktreeDialog.repoId, branchName, path);
        }}
      />
    </div>
  );
});

GitBranches.displayName = 'GitBranches';
