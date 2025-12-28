import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoHeader } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitReposProps = {
  repos: RepoHeader[];
  activeRepoId?: string | null;
  onActivateRepo?: (repoId: string) => void;
  onRemoveRepo?: (repoId: string) => void;
};

export function GitRepos({ repos, activeRepoId, onActivateRepo, onRemoveRepo }: GitReposProps) {
  const nodes: TreeNode[] = repos.map((repo) => ({
    id: repo.repoId,
    label: repo.name,
    description: repo.path,
    icon: "folder",
    rightSlot: repo.repoId === activeRepoId ? <span className="git-badge">active</span> : undefined,
    actions: [
      {
        id: "remove",
        icon: "trash",
        label: "Remove",
        intent: "danger",
      },
    ],
  }));

  const handleAction = (node: TreeNode, actionId: string) => {
    if (actionId === "remove") {
      onRemoveRepo?.(node.id);
    }
  };

  const handleNodeActivate = (node: TreeNode) => {
    onActivateRepo?.(node.id);
  };

  return (
    <div className="git-tree">
      <TreeView
        nodes={nodes}
        onNodeActivate={handleNodeActivate}
        onAction={handleAction}
      />
      {!repos.length ? (
        <div className="git-empty">
          <Icon name="folder" size={22} />
          <p>No repositories bound.</p>
        </div>
      ) : null}
    </div>
  );
}
