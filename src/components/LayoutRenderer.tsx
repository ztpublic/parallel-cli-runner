import { LayoutNode, PaneNode, countPanes } from "../types/layout";
import { TerminalPane } from "./TerminalPane";

type LayoutRendererProps = {
  node: LayoutNode;
  activePaneId: string | null;
  onFocusPane: (id: string) => void;
  onPaneInput?: (pane: PaneNode, data: string) => void;
};

export function LayoutRenderer({
  node,
  activePaneId,
  onFocusPane,
  onPaneInput,
}: LayoutRendererProps) {
  if (node.type === "pane") {
    return (
      <TerminalPane
        pane={node}
        isActive={node.id === activePaneId}
        onFocused={onFocusPane}
        onInput={onPaneInput}
      />
    );
  }

  const direction =
    node.orientation === "vertical" ? "split-vertical" : "split-horizontal";

  return (
    <div className={`split ${direction}`}>
      {node.children.map((child) => (
        <div
          key={child.id}
          className="split-child"
          style={{ flexGrow: countPanes(child) || 1 }}
        >
          <LayoutRenderer
            node={child}
            activePaneId={activePaneId}
            onFocusPane={onFocusPane}
            onPaneInput={onPaneInput}
          />
        </div>
      ))}
    </div>
  );
}

