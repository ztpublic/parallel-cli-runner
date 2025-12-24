import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoBranchGroup } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitBranchesProps = {
  branchGroups: RepoBranchGroup[];
  onLoadMoreLocal?: (repoId: string) => void;
  onLoadMoreRemote?: (repoId: string) => void;
  canLoadMoreLocal?: (repoId: string) => boolean;
  canLoadMoreRemote?: (repoId: string) => boolean;
};

export function GitBranches({
  branchGroups,
  onLoadMoreLocal,
  onLoadMoreRemote,
  canLoadMoreLocal,
  canLoadMoreRemote,
}: GitBranchesProps) {
  const nodes: TreeNode[] = branchGroups.map((group) => {
    const localChildren: TreeNode[] = group.localBranches.map((branch) => ({
      id: `${group.repo.repoId}:local:${branch.name}`,
      label: branch.name,
      description: branch.lastCommit,
      icon: "branch",
      rightSlot: branch.current ? (
        <span className="git-badge">current</span>
      ) : undefined,
      actions: [
        {
          id: "merge",
          icon: "merge",
          label: "Merge",
        },
        {
          id: "delete",
          icon: "trash",
          label: "Delete",
          intent: "danger",
        },
      ],
    }));

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
      actions: [
        {
          id: "open-pr",
          icon: "pull",
          label: "Open PR",
        },
      ],
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
          defaultExpanded: true,
          selectable: false,
          rightSlot: <span className="git-pill">{group.remoteBranches.length}</span>,
          children: remoteChildren,
        },
      ],
    };
  });

  const handleNodeActivate = (node: TreeNode) => {
    if (node.id.endsWith(":local:load-more")) {
      const repoId = node.id.replace(":local:load-more", "");
      onLoadMoreLocal?.(repoId);
    } else if (node.id.endsWith(":remote:load-more")) {
      const repoId = node.id.replace(":remote:load-more", "");
      onLoadMoreRemote?.(repoId);
    }
  };

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} toggleOnRowClick onNodeActivate={handleNodeActivate} />
      {!branchGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}
    </div>
  );
}
