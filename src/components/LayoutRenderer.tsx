import { LayoutNode } from "../types/layout";
import { TerminalPane } from "./TerminalPane";
import { AgentPane } from "./AgentPane";
import { EmptyPane } from "./EmptyPane";

type LayoutRendererProps = {
  node: LayoutNode;
  activePaneId: string | null;
  onFocus: (id: string) => void;
  onChooseEmptyPane?: (paneId: string, paneType: "terminal" | "agent") => void;
  layoutTick?: number;
  onClose?: () => void;
};

export function LayoutRenderer({
  node,
  activePaneId,
  onFocus,
  onChooseEmptyPane,
  layoutTick,
  onClose,
}: LayoutRendererProps) {
  if (node.type === "pane") {
    const isActive = node.id === activePaneId;

    // Empty pane - render placeholder
    if (node.isEmpty && onChooseEmptyPane) {
      return (
        <EmptyPane
          pane={node}
          onChoose={onChooseEmptyPane}
        />
      );
    }

    // Agent pane
    if (node.paneType === "agent") {
      return (
        <AgentPane
          pane={node}
          isActive={isActive}
          onFocused={onFocus}
          onClose={onClose}
        />
      );
    }

    // Terminal pane (default)
    return (
      <TerminalPane
        pane={node}
        isActive={isActive}
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
        onChooseEmptyPane={onChooseEmptyPane}
        layoutTick={layoutTick}
        onClose={onClose}
      />
      <LayoutRenderer
        node={node.children[1]}
        activePaneId={activePaneId}
        onFocus={onFocus}
        onChooseEmptyPane={onChooseEmptyPane}
        layoutTick={layoutTick}
        onClose={onClose}
      />
    </div>
  );
}
