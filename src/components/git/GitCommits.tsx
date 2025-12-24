import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { CommitItem, RepoGroup } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitCommitsProps = {
  commitGroups: RepoGroup<CommitItem>[];
  onLoadMore?: (repoId: string) => void;
  canLoadMore?: (repoId: string) => boolean;
  isLoadingMore?: (repoId: string) => boolean;
};

export function GitCommits({
  commitGroups,
  onLoadMore,
  canLoadMore,
  isLoadingMore,
}: GitCommitsProps) {
  const nodes: TreeNode[] = commitGroups.map((group) => {
    const children: TreeNode[] = group.items.map((commit) => ({
      id: `${group.repo.repoId}:${commit.id}`,
      label: commit.message,
      description: `${commit.author} - ${commit.date}`,
      icon: "commit",
    }));

    if (canLoadMore?.(group.repo.repoId)) {
      children.push({
        id: `${group.repo.repoId}:load-more-commits`,
        label: "Load More...",
        variant: "load-more",
        isLoading: isLoadingMore?.(group.repo.repoId),
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
      rightSlot: <span className="git-pill">{group.items.length}</span>,
      children,
    };
  });

  const handleNodeActivate = (node: TreeNode) => {
    if (node.id.endsWith(":load-more-commits")) {
      const repoId = node.id.replace(":load-more-commits", "");
      onLoadMore?.(repoId);
    }
  };

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} toggleOnRowClick onNodeActivate={handleNodeActivate} />
      {!commitGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}
    </div>
  );
}
