import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoGroup, WorktreeItem } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitWorktreesProps = {
  worktreeGroups: RepoGroup<WorktreeItem>[];
};

export function GitWorktrees({ worktreeGroups }: GitWorktreesProps) {
  const nodes: TreeNode[] = worktreeGroups.map((group) => ({
    id: group.repo.repoId,
    label: group.repo.name,
    description: group.repo.path,
    icon: "folder",
    defaultExpanded: true,
    selectable: false,
    rightSlot: <span className="git-pill">{group.items.length}</span>,
    children: group.items.map((worktree) => ({
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
      ],
    })),
  }));

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} toggleOnRowClick />
      {!worktreeGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}
    </div>
  );
}
