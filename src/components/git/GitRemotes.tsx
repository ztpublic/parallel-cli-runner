import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RemoteItem, RepoGroup } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitRemotesProps = {
  remoteGroups: RepoGroup<RemoteItem>[];
};

export function GitRemotes({ remoteGroups }: GitRemotesProps) {
  const nodes: TreeNode[] = remoteGroups.map((group) => ({
    id: group.repo.repoId,
    label: group.repo.name,
    description: group.repo.path,
    icon: "folder",
    defaultExpanded: true,
    selectable: false,
    rightSlot: <span className="git-pill">{group.items.length}</span>,
    children: group.items.map((remote) => ({
      id: `${group.repo.repoId}:remote:${remote.name}`,
      label: remote.name,
      description: `Fetch: ${remote.fetch}`,
      icon: "cloud",
    })),
  }));

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} />
      {!remoteGroups.length ? (
        <div className="git-empty">
          <Icon name="cloud" size={22} />
          <p>No remotes configured.</p>
        </div>
      ) : null}
    </div>
  );
}