import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoGroup, StashItem } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitStashesProps = {
  stashGroups: RepoGroup<StashItem>[];
  onApplyStash?: (repoId: string, stashIndex: number) => void;
  onDeleteStash?: (repoId: string, stashIndex: number) => void;
};

export function GitStashes({
  stashGroups,
  onApplyStash,
  onDeleteStash,
}: GitStashesProps) {
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
        actions: [
          {
            id: "apply-stash",
            icon: "play",
            label: "Apply",
          },
          {
            id: "delete-stash",
            icon: "trash",
            label: "Delete",
            intent: "danger",
          },
        ],
      };
    }),
  }));

  const handleAction = (node: TreeNode, actionId: string) => {
    const parts = node.id.split(":stash:");
    if (parts.length !== 2) return;
    const [repoId, stashId] = parts;
    const group = stashGroups.find((entry) => entry.repo.repoId === repoId);
    const stash = group?.items.find((item) => item.id === stashId);
    if (!stash) return;

    if (actionId === "apply-stash") {
      onApplyStash?.(repoId, stash.index);
    } else if (actionId === "delete-stash") {
      onDeleteStash?.(repoId, stash.index);
    }
  };

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} onAction={handleAction} />
      {!stashGroups.length ? (
        <div className="git-empty">
          <Icon name="archive" size={22} />
          <p>No stashes found.</p>
        </div>
      ) : null}
    </div>
  );
}
