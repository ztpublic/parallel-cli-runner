import { memo, useMemo, useCallback } from "react";
import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoHeader } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

const ActiveRepoBadge = memo(function ActiveRepoBadge({ isActive }: { isActive: boolean }) {
  return isActive ? <span className="git-badge">active</span> : null;
});

ActiveRepoBadge.displayName = 'ActiveRepoBadge';

type GitReposProps = {
  repos: RepoHeader[];
  enabledRepoIds?: string[];
  onEnableRepos?: (repoIds: string[]) => void;
  activeRepoId?: string | null;
  onActivateRepo?: (repoId: string) => void;
  onRemoveRepo?: (repoId: string) => void;
  onOpenTerminal?: (repo: RepoHeader) => void;
  onOpenRepoFolder?: (repo: RepoHeader) => void;
};

export const GitRepos = memo(function GitRepos({
  repos,
  enabledRepoIds,
  onEnableRepos,
  activeRepoId,
  onActivateRepo,
  onRemoveRepo,
  onOpenTerminal,
  onOpenRepoFolder,
}: GitReposProps) {
  const nodes: TreeNode[] = useMemo(() => {
    return repos.map((repo) => ({
      id: repo.repoId,
      label: repo.name,
      description: repo.path,
      icon: "folder",
      checkable: true,
      rightSlot: <ActiveRepoBadge isActive={repo.repoId === activeRepoId} />,
      actions: [
        {
          id: "open-folder",
          icon: "folder",
          label: "Open in File Explorer",
          disabled: !onOpenRepoFolder,
        },
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
  }, [repos, activeRepoId, onOpenRepoFolder]);

  const handleAction = useCallback((node: TreeNode, actionId: string) => {
    const repo = repos.find((item) => item.repoId === node.id);
    if (actionId === "terminal") {
      if (repo) {
        onOpenTerminal?.(repo);
      }
      return;
    }
    if (actionId === "open-folder") {
      if (repo) {
        onOpenRepoFolder?.(repo);
      }
      return;
    }
    if (actionId === "remove") {
      onRemoveRepo?.(node.id);
    }
  }, [repos, onOpenTerminal, onOpenRepoFolder, onRemoveRepo]);

  const handleNodeActivate = useCallback((node: TreeNode) => {
    onActivateRepo?.(node.id);
  }, [onActivateRepo]);

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
});

GitRepos.displayName = 'GitRepos';
