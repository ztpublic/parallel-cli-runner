import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoBranchGroup } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitBranchesProps = {
  branchGroups: RepoBranchGroup[];
};

export function GitBranches({ branchGroups }: GitBranchesProps) {
  const nodes: TreeNode[] = branchGroups.map((group) => ({
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
        children: group.localBranches.map((branch) => ({
          id: `${group.repo.repoId}:local:${branch.name}`,
          label: branch.name,
          description: branch.lastCommit,
          icon: "branch",
          rightSlot: branch.current ? <span className="git-badge">current</span> : undefined,
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
        })),
      },
      {
        id: `${group.repo.repoId}:remote`,
        label: "Remote Branches",
        icon: "cloud",
        defaultExpanded: true,
        selectable: false,
        rightSlot: <span className="git-pill">{group.remoteBranches.length}</span>,
        children: group.remoteBranches.map((branch) => ({
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
        })),
      },
    ],
  }));

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} toggleOnRowClick />
      {!branchGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}
    </div>
  );
}
