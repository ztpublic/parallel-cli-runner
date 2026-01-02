import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoGroup, TagItem } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitTagsProps = {
  tagGroups: RepoGroup<TagItem>[];
  onLoadMore?: (repoId: string) => void;
  canLoadMore?: (repoId: string) => boolean;
  isLoadingMore?: (repoId: string) => boolean;
};

export function GitTags({
  tagGroups,
  onLoadMore,
  canLoadMore,
  isLoadingMore,
}: GitTagsProps) {
  const idSeparator = "::";
  const encodeNodePart = (value: string) => encodeURIComponent(value);
  const decodeNodePart = (value: string) => decodeURIComponent(value);
  const makeLoadMoreNodeId = (repoId: string) =>
    `tag-load-more${idSeparator}${encodeNodePart(repoId)}`;

  const nodes: TreeNode[] = tagGroups.map((group) => ({
    id: group.repo.repoId,
    label: group.repo.name,
    description: group.repo.path,
    icon: "folder",
    defaultExpanded: true,
    selectable: false,
    rightSlot: <span className="git-pill">{group.items.length}</span>,
    children: [
      ...group.items.map((tag) => ({
        id: `${group.repo.repoId}:tag:${tag.name}`,
        label: tag.name,
        icon: "tag",
      })),
      ...(canLoadMore?.(group.repo.repoId)
        ? [
            {
              id: makeLoadMoreNodeId(group.repo.repoId),
              label: "Load More...",
              variant: "load-more",
              isLoading: isLoadingMore?.(group.repo.repoId),
              selectable: false,
            },
          ]
        : []),
    ],
  }));

  const parseLoadMoreNodeId = (nodeId: string) => {
    const parts = nodeId.split(idSeparator);
    if (parts.length !== 2 || parts[0] !== "tag-load-more") return null;
    return { repoId: decodeNodePart(parts[1]) };
  };

  const handleNodeActivate = (node: TreeNode) => {
    const parsed = parseLoadMoreNodeId(node.id);
    if (parsed) {
      onLoadMore?.(parsed.repoId);
    }
  };

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} onNodeActivate={handleNodeActivate} />
      {!tagGroups.length ? (
        <div className="git-empty">
          <Icon name="tag" size={22} />
          <p>No tags found.</p>
        </div>
      ) : null}
    </div>
  );
}
