export type Orientation = "vertical" | "horizontal";

export type PaneMeta = {
  title?: string;
  subtitle?: string;
  cwd?: string;
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

export function appendPaneToLayout(
  node: LayoutNode | null,
  pane: PaneNode,
  orientation: Orientation = "vertical"
): LayoutNode | null {
  if (!node) return pane;
  return {
    type: "split",
    id: createId(),
    orientation,
    children: [node, pane],
  };
}

export function getLayoutOrientation(
  node: LayoutNode | null,
  fallback: Orientation = "vertical"
): Orientation {
  if (!node) return fallback;
  return node.type === "split" ? node.orientation : fallback;
}

export function splitPane(
  node: LayoutNode,
  targetPaneId: string,
  pane: PaneNode,
  orientation: Orientation
): LayoutNode {
  const [next, didSplit] = splitPaneRecursive(node, targetPaneId, pane, orientation);
  return didSplit ? next : node;
}

function splitPaneRecursive(
  node: LayoutNode,
  targetPaneId: string,
  pane: PaneNode,
  orientation: Orientation
): [LayoutNode, boolean] {
  if (node.type === "pane") {
    if (node.id !== targetPaneId) return [node, false];
    return [
      {
        type: "split",
        id: createId(),
        orientation,
        children: [node, pane],
      },
      true,
    ];
  }

  const [nextLeft, splitLeft] = splitPaneRecursive(
    node.children[0],
    targetPaneId,
    pane,
    orientation
  );
  if (splitLeft) {
    return [{ ...node, children: [nextLeft, node.children[1]] }, true];
  }

  const [nextRight, splitRight] = splitPaneRecursive(
    node.children[1],
    targetPaneId,
    pane,
    orientation
  );
  if (splitRight) {
    return [{ ...node, children: [node.children[0], nextRight] }, true];
  }

  return [node, false];
}

export function buildLayoutFromPanes(
  panes: PaneNode[],
  orientation: Orientation = "vertical"
): LayoutNode | null {
  if (!panes.length) return null;
  return panes.reduce<LayoutNode | null>(
    (acc, pane) => appendPaneToLayout(acc, pane, orientation),
    null
  );
}
