import { LayoutNode } from "../types/layout";
import { TerminalPane } from "./TerminalPane";

type LayoutRendererProps = {
  node: LayoutNode;
  activePaneId: string | null;
  onFocus: (id: string) => void;
  layoutTick?: number;
};

export function LayoutRenderer({
  node,
  activePaneId,
  onFocus,
  layoutTick,
}: LayoutRendererProps) {
  if (node.type === "pane") {
    return (
      <TerminalPane
        pane={node}
        isActive={node.id === activePaneId}
        onFocused={onFocus}
        layoutTick={layoutTick}
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
        layoutTick={layoutTick}
      />
      <LayoutRenderer
        node={node.children[1]}
        activePaneId={activePaneId}
        onFocus={onFocus}
        layoutTick={layoutTick}
      />
    </div>
  );
}
