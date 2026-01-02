import { useState } from "react";
import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import { ResetDialog } from "../dialogs/ResetDialog";
import { RevertDialog } from "../dialogs/RevertDialog";
import type { RepoGroup, WorktreeCommits } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitCommitsProps = {
  commitGroups: RepoGroup<WorktreeCommits>[];
  onLoadMore?: (repoId: string, worktreePath: string) => void;
  canLoadMore?: (repoId: string, worktreePath: string) => boolean;
  isLoadingMore?: (repoId: string, worktreePath: string) => boolean;
  onReset?: (
    repoId: string,
    worktreePath: string,
    commitId: string,
    mode: "soft" | "mixed" | "hard"
  ) => void;
  onRevert?: (repoId: string, worktreePath: string, commitId: string) => void;
  onSquashCommits?: (repoId: string, worktreePath: string, commitIds: string[]) => void;
};

export function GitCommits({
  commitGroups,
  onLoadMore,
  canLoadMore,
  isLoadingMore,
  onReset,
  onRevert,
  onSquashCommits,
}: GitCommitsProps) {
  const [resetDialog, setResetDialog] = useState<{
    open: boolean;
    repoId: string;
    worktreePath: string;
    commitId: string;
  }>({ open: false, repoId: "", worktreePath: "", commitId: "" });

  const [revertDialog, setRevertDialog] = useState<{
    open: boolean;
    repoId: string;
    worktreePath: string;
    commitId: string;
  }>({ open: false, repoId: "", worktreePath: "", commitId: "" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const idSeparator = "::";
  const encodeNodePart = (value: string) => encodeURIComponent(value);
  const decodeNodePart = (value: string) => decodeURIComponent(value);
  const makeWorktreeNodeId = (repoId: string, worktreePath: string) =>
    `worktree${idSeparator}${encodeNodePart(repoId)}${idSeparator}${encodeNodePart(worktreePath)}`;
  const makeCommitNodeId = (repoId: string, worktreePath: string, commitId: string) =>
    `commit${idSeparator}${encodeNodePart(repoId)}${idSeparator}${encodeNodePart(worktreePath)}${idSeparator}${commitId}`;
  const makeLoadMoreNodeId = (repoId: string, worktreePath: string) =>
    `commit-load-more${idSeparator}${encodeNodePart(repoId)}${idSeparator}${encodeNodePart(worktreePath)}`;

  const nodes: TreeNode[] = commitGroups.map((group) => {
    const worktreeNodes: TreeNode[] = group.items.map((worktreeGroup) => {
      const commitNodes: TreeNode[] = worktreeGroup.commits.map((commit) => ({
        id: makeCommitNodeId(group.repo.repoId, worktreeGroup.worktree.path, commit.id),
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

      if (canLoadMore?.(group.repo.repoId, worktreeGroup.worktree.path)) {
        commitNodes.push({
          id: makeLoadMoreNodeId(group.repo.repoId, worktreeGroup.worktree.path),
          label: "Load More...",
          variant: "load-more",
          isLoading: isLoadingMore?.(group.repo.repoId, worktreeGroup.worktree.path),
          selectable: false,
        });
      }

      return {
        id: makeWorktreeNodeId(group.repo.repoId, worktreeGroup.worktree.path),
        label: worktreeGroup.worktree.branch,
        description: worktreeGroup.worktree.path,
        icon: "folder",
        defaultExpanded: true,
        selectable: false,
        rightSlot: <span className="git-pill">{worktreeGroup.commits.length}</span>,
        children: commitNodes,
      };
    });

    const totalCommits = group.items.reduce((sum, item) => sum + item.commits.length, 0);

    return {
      id: group.repo.repoId,
      label: group.repo.name,
      description: group.repo.activeBranch
        ? `${group.repo.activeBranch} • ${group.repo.path}`
        : group.repo.path,
      icon: "folder",
      defaultExpanded: true,
      selectable: false,
      rightSlot: <span className="git-pill">{totalCommits}</span>,
      children: worktreeNodes,
    };
  });

  const parseCommitNodeId = (nodeId: string) => {
    const parts = nodeId.split(idSeparator);
    if (parts.length !== 4 || parts[0] !== "commit") return null;
    return {
      repoId: decodeNodePart(parts[1]),
      worktreePath: decodeNodePart(parts[2]),
      commitId: parts[3],
    };
  };

  const parseLoadMoreNodeId = (nodeId: string) => {
    const parts = nodeId.split(idSeparator);
    if (parts.length !== 3 || parts[0] !== "commit-load-more") return null;
    return {
      repoId: decodeNodePart(parts[1]),
      worktreePath: decodeNodePart(parts[2]),
    };
  };

  const getSelectedCommitIdsForWorktree = (
    repoId: string,
    worktreePath: string,
    ids: string[]
  ) =>
    ids
      .map(parseCommitNodeId)
      .filter(
        (parsed): parsed is { repoId: string; worktreePath: string; commitId: string } =>
          Boolean(parsed)
      )
      .filter((parsed) => parsed.repoId === repoId && parsed.worktreePath === worktreePath)
      .map((parsed) => parsed.commitId);

  const handleNodeActivate = (node: TreeNode) => {
    const parsed = parseLoadMoreNodeId(node.id);
    if (parsed) {
      onLoadMore?.(parsed.repoId, parsed.worktreePath);
    }
  };

  const handleContextMenuSelect = (node: TreeNode, itemId: string) => {
    const parsed = parseCommitNodeId(node.id);
    if (!parsed) return;

    const { repoId, worktreePath, commitId } = parsed;

    if (itemId === "reset") {
      setResetDialog({ open: true, repoId, worktreePath, commitId });
    } else if (itemId === "revert") {
      setRevertDialog({ open: true, repoId, worktreePath, commitId });
    } else if (itemId === "squash-commits") {
      const commitIds = getSelectedCommitIdsForWorktree(repoId, worktreePath, selectedIds);
      if (commitIds.length > 1) {
        onSquashCommits?.(repoId, worktreePath, commitIds);
      }
    }
  };

  const getContextMenuItems = (node: TreeNode, activeSelectedIds: string[]) => {
    const baseItems = node.contextMenu ?? [];
    if (activeSelectedIds.length < 2) return baseItems;

    const parsed = parseCommitNodeId(node.id);
    if (!parsed) return baseItems;

    const commitIds = getSelectedCommitIdsForWorktree(
      parsed.repoId,
      parsed.worktreePath,
      activeSelectedIds
    );
    if (commitIds.length < 2) return baseItems;

    return [{ id: "squash-commits", label: "Squash Commits" }, ...baseItems];
  };

  return (
    <div className="git-tree">
      <TreeView
        nodes={nodes}
        selectionMode="multiple"
        toggleOnRowClick
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onNodeActivate={handleNodeActivate}
        onContextMenuSelect={handleContextMenuSelect}
        getContextMenuItems={getContextMenuItems}
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
          onReset?.(resetDialog.repoId, resetDialog.worktreePath, resetDialog.commitId, mode);
        }}
      />

      <RevertDialog
        open={revertDialog.open}
        commitHash={revertDialog.commitId}
        onClose={() => setRevertDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={() => {
          onRevert?.(revertDialog.repoId, revertDialog.worktreePath, revertDialog.commitId);
        }}
      />
    </div>
  );
}
