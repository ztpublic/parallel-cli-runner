export type Orientation = "vertical" | "horizontal";

export type PaneMeta = {
  agentId?: string;
  agentName?: string;
  branchName?: string;
  worktreePath?: string;
};

export type PaneNode = {
  type: "pane";
  id: string;
  sessionId: string;
  meta?: PaneMeta;
};

export type SplitNode = {
  type: "split";
  id: string;
  orientation: Orientation;
  children: [LayoutNode, LayoutNode];
};

export type LayoutNode = PaneNode | SplitNode;

export const createId = () => crypto.randomUUID();

export function countPanes(node: LayoutNode | null): number {
  if (!node) return 0;
  if (node.type === "pane") return 1;
  return countPanes(node.children[0]) + countPanes(node.children[1]);
}

export function findPane(node: LayoutNode | null, paneId: string): PaneNode | null {
  if (!node) return null;
  if (node.type === "pane") return node.id === paneId ? node : null;
  return (
    findPane(node.children[0], paneId) ||
    findPane(node.children[1], paneId)
  );
}

export function getFirstPane(node: LayoutNode | null): PaneNode | null {
  if (!node) return null;
  if (node.type === "pane") return node;
  return getFirstPane(node.children[0]) ?? getFirstPane(node.children[1]);
}

export function collectPanes(node: LayoutNode | null, acc: PaneNode[] = []): PaneNode[] {
  if (!node) return acc;
  if (node.type === "pane") {
    acc.push(node);
    return acc;
  }
  collectPanes(node.children[0], acc);
  collectPanes(node.children[1], acc);
  return acc;
}

export function removePane(
  node: LayoutNode,
  targetPaneId: string
): LayoutNode | null {
  if (node.type === "pane") {
    return node.id === targetPaneId ? null : node;
  }

  const nextLeft = removePane(node.children[0], targetPaneId);
  const nextRight = removePane(node.children[1], targetPaneId);

  if (!nextLeft && !nextRight) {
    return null;
  }
  if (!nextLeft) {
    return nextRight;
  }
  if (!nextRight) {
    return nextLeft;
  }

  return { ...node, children: [nextLeft, nextRight] };
}

export function buildLayoutFromPanes(panes: PaneNode[]): LayoutNode | null {
  if (!panes.length) return null;
  return panes.reduce<LayoutNode | null>((acc, pane) => {
    if (!acc) return pane;
    return {
      type: "split",
      id: createId(),
      orientation: "vertical",
      children: [acc, pane],
    };
  }, null);
}

