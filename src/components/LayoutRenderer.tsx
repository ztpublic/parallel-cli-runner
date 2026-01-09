import { LayoutNode } from "../types/layout";
import { TerminalPane } from "./TerminalPane";
import { AgentPane } from "./AgentPane";
import { EmptyPane } from "./EmptyPane";
import type { RepoInfoDto } from "../types/git";
import type { WorktreeItem } from "../types/git-ui";

type LayoutRendererProps = {
  node: LayoutNode;
  activePaneId: string | null;
  onFocus: (id: string) => void;
  onChooseEmptyPane?: (paneId: string, paneType: "terminal" | "agent", cwd?: string) => void;
  layoutTick?: number;
  onClose?: () => void;
  repos?: RepoInfoDto[];
  worktreesByRepo?: Record<string, WorktreeItem[]>;
};

export function LayoutRenderer({
  node,
  activePaneId,
  onFocus,
  onChooseEmptyPane,
  layoutTick,
  onClose,
  repos = [],
  worktreesByRepo = {},
}: LayoutRendererProps) {
  if (node.type === "pane") {
    const isActive = node.id === activePaneId;

    // Empty pane - render placeholder
    if (node.isEmpty && onChooseEmptyPane) {
      return (
        <EmptyPane
          pane={node}
          onChoose={onChooseEmptyPane}
          repos={repos}
          worktreesByRepo={worktreesByRepo}
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
        repos={repos}
        worktreesByRepo={worktreesByRepo}
      />
      <LayoutRenderer
        node={node.children[1]}
        activePaneId={activePaneId}
        onFocus={onFocus}
        onChooseEmptyPane={onChooseEmptyPane}
        layoutTick={layoutTick}
        onClose={onClose}
        repos={repos}
        worktreesByRepo={worktreesByRepo}
      />
    </div>
  );
}
