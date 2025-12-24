import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RemoteItem } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitRemotesProps = {
  remotes: RemoteItem[];
};

export function GitRemotes({ remotes }: GitRemotesProps) {
  const nodes: TreeNode[] = remotes.map((remote) => ({
    id: `remote:${remote.name}`,
    label: remote.name,
    description: `Fetch: ${remote.fetch} - Push: ${remote.push}`,
    icon: "cloud",
  }));

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} />
      {!remotes.length ? (
        <div className="git-empty">
          <Icon name="cloud" size={22} />
          <p>No remotes configured.</p>
        </div>
      ) : null}
    </div>
  );
}
