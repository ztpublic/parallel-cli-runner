import { memo, useMemo, useCallback, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import { ActionMenu } from "../ActionMenu";
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
  onOpenAgent?: (repo: RepoHeader) => void;
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
  onOpenAgent,
}: GitReposProps) {
  const [actionMenu, setActionMenu] = useState<{
    node: TreeNode;
    position: { x: number; y: number };
  } | null>(null);

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
          id: "open",
          icon: "plus",
          label: "Open",
        },
        {
          id: "remove",
          icon: "trash",
          label: "Remove",
          intent: "danger",
        },
      ],
    }));
  }, [repos, activeRepoId]);

  const handleAction = useCallback((node: TreeNode, actionId: string, event?: ReactMouseEvent) => {
    const repo = repos.find((item) => item.repoId === node.id);

    if (actionId === "remove") {
      onRemoveRepo?.(node.id);
      return;
    }

    if (actionId === "open") {
      // Show the action menu
      if (event) {
        const buttonElement = event.currentTarget;
        const rect = buttonElement.getBoundingClientRect();
        setActionMenu({
          node,
          position: {
            x: rect.left,
            y: rect.bottom + 4,
          },
        });
      }
      return;
    }

    // Handle menu actions: open-folder, terminal, open-agent
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

    if (actionId === "open-agent") {
      if (repo) {
        onOpenAgent?.(repo);
      }
      return;
    }
  }, [repos, onOpenTerminal, onOpenRepoFolder, onOpenAgent, onRemoveRepo]);

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
      {actionMenu ? (
        <ActionMenu
          items={[
            { id: "open-folder", icon: "folder", label: "Open in File Explorer" },
            { id: "terminal", icon: "terminal", label: "Terminal" },
            { id: "open-agent", icon: "robot", label: "Open Agent" },
          ]}
          position={actionMenu.position}
          onSelect={(itemId) => {
            handleAction(actionMenu.node, itemId);
            setActionMenu(null);
          }}
          onClose={() => setActionMenu(null)}
        />
      ) : null}
    </div>
  );
});

GitRepos.displayName = 'GitRepos';
