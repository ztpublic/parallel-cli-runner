import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { CommitItem, RepoGroup } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitCommitsProps = {
  commitGroups: RepoGroup<CommitItem>[];
};

export function GitCommits({ commitGroups }: GitCommitsProps) {
  const nodes: TreeNode[] = commitGroups.map((group) => ({
    id: group.repo.repoId,
    label: group.repo.name,
    description: group.repo.path,
    icon: "folder",
    defaultExpanded: true,
    selectable: false,
    rightSlot: <span className="git-pill">{group.items.length}</span>,
    children: group.items.map((commit) => ({
      id: `${group.repo.repoId}:${commit.id}`,
      label: commit.message,
      description: `${commit.author} - ${commit.date}`,
      icon: "commit",
      rightSlot: <span className="git-hash">{commit.id}</span>,
    })),
  }));

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} toggleOnRowClick />
      {!commitGroups.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}
    </div>
  );
}
