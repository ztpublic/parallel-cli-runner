import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoGroup, StashItem } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitStashesProps = {
  stashGroups: RepoGroup<StashItem>[];
};

export function GitStashes({ stashGroups }: GitStashesProps) {
  const nodes: TreeNode[] = stashGroups.map((group) => ({
    id: group.repo.repoId,
    label: group.repo.name,
    description: group.repo.path,
    icon: "folder",
    defaultExpanded: true,
    selectable: false,
    rightSlot: <span className="git-pill">{group.items.length}</span>,
    children: group.items.map((stash) => {
      const stashLabel = stash.message || `stash@{${stash.index}}`;
      const stashId = `stash@{${stash.index}}`;
      const description = stash.relativeTime
        ? `${stashId} - ${stash.relativeTime}`
        : stashId;
      return {
        id: `${group.repo.repoId}:stash:${stash.id}`,
        label: stashLabel,
        description,
        icon: "archive",
      };
    }),
  }));

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} />
      {!stashGroups.length ? (
        <div className="git-empty">
          <Icon name="archive" size={22} />
          <p>No stashes found.</p>
        </div>
      ) : null}
    </div>
  );
}
