import { LayoutNode } from "../types/layout";
import { TerminalPane } from "./TerminalPane";

type LayoutRendererProps = {
  node: LayoutNode;
  activePaneId: string | null;
  onFocus: (id: string) => void;
};

export function LayoutRenderer({ node, activePaneId, onFocus }: LayoutRendererProps) {
  if (node.type === "pane") {
    return (
      <TerminalPane
        pane={node}
        isActive={node.id === activePaneId}
        onFocused={onFocus}
      />
    );
  }

  const isVertical = node.orientation === "vertical";

  return (
    <div
      className={`split ${isVertical ? "split-vertical" : "split-horizontal"}`}
    >
      <LayoutRenderer
        node={node.children[0]}
        activePaneId={activePaneId}
        onFocus={onFocus}
      />
      <LayoutRenderer
        node={node.children[1]}
        activePaneId={activePaneId}
        onFocus={onFocus}
      />
    </div>
  );
}
