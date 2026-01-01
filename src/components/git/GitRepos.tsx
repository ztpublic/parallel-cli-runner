import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoHeader } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitReposProps = {
  repos: RepoHeader[];
  enabledRepoIds?: string[];
  onEnableRepos?: (repoIds: string[]) => void;
  activeRepoId?: string | null;
  onActivateRepo?: (repoId: string) => void;
  onRemoveRepo?: (repoId: string) => void;
  onOpenTerminal?: (repo: RepoHeader) => void;
};

export function GitRepos({
  repos,
  enabledRepoIds,
  onEnableRepos,
  activeRepoId,
  onActivateRepo,
  onRemoveRepo,
  onOpenTerminal,
}: GitReposProps) {
  const nodes: TreeNode[] = repos.map((repo) => ({
    id: repo.repoId,
    label: repo.name,
    description: repo.path,
    icon: "folder",
    checkable: true,
    rightSlot: repo.repoId === activeRepoId ? <span className="git-badge">active</span> : undefined,
    actions: [
      {
        id: "terminal",
        icon: "terminal",
        label: "Terminal",
      },
      {
        id: "remove",
        icon: "trash",
        label: "Remove",
        intent: "danger",
      },
    ],
  }));

  const handleAction = (node: TreeNode, actionId: string) => {
    const repo = repos.find((item) => item.repoId === node.id);
    if (actionId === "terminal") {
      if (repo) {
        onOpenTerminal?.(repo);
      }
      return;
    }
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
        checkedIds={enabledRepoIds}
        onCheckChange={onEnableRepos}
        onNodeActivate={handleNodeActivate}
        onAction={handleAction}
        toggleOnRowClick={false}
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
