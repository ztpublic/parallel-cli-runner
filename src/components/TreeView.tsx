import { useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { Icon } from "./Icons";
import { ContextMenu } from "./ContextMenu";
import type {
  TreeNode,
  TreeNodeContextMenuItem,
  TreeSelectionMode,
} from "../types/tree";

type TreeViewProps = {
  nodes: TreeNode[];
  selectionMode?: TreeSelectionMode;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onNodeToggle?: (nodeId: string, expanded: boolean) => void;
  onNodeActivate?: (node: TreeNode) => void;
  onContextMenuSelect?: (node: TreeNode, itemId: string) => void;
  toggleOnRowClick?: boolean;
  renderRightSlot?: (node: TreeNode) => ReactNode;
  renderActions?: (node: TreeNode) => ReactNode;
};

export function TreeView({
  nodes,
  selectionMode = "none",
  selectedIds,
  onSelectionChange,
  onNodeToggle,
  onNodeActivate,
  onContextMenuSelect,
  toggleOnRowClick = false,
  renderRightSlot,
  renderActions,
}: TreeViewProps) {
  const isControlled = selectedIds !== undefined;
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    const walk = (items: TreeNode[]) => {
      items.forEach((item) => {
        if (item.defaultExpanded) {
          expanded.add(item.id);
        }
        if (item.children?.length) {
          walk(item.children);
        }
      });
    };
    walk(nodes);
    return expanded;
  });
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    items: TreeNodeContextMenuItem[];
    position: { x: number; y: number };
    node: TreeNode;
  } | null>(null);

  const resolvedSelectedIds = isControlled ? selectedIds ?? [] : internalSelectedIds;

  const selectableNodeIds = useMemo(() => {
    const result: string[] = [];
    const walk = (items: TreeNode[]) => {
      items.forEach((item) => {
        const selectable = selectionMode !== "none" && item.selectable !== false;
        if (selectable) {
          result.push(item.id);
        }
        if (item.children?.length && expandedNodes.has(item.id)) {
          walk(item.children);
        }
      });
    };
    walk(nodes);
    return result;
  }, [expandedNodes, nodes, selectionMode]);

  const setSelection = (nextSelected: string[]) => {
    if (!isControlled) {
      setInternalSelectedIds(nextSelected);
    }
    onSelectionChange?.(nextSelected);
  };

  const toggleExpanded = (node: TreeNode) => {
    const nextExpanded = new Set(expandedNodes);
    const isExpanded = nextExpanded.has(node.id);
    if (isExpanded) {
      nextExpanded.delete(node.id);
    } else {
      nextExpanded.add(node.id);
    }
    setExpandedNodes(nextExpanded);
    onNodeToggle?.(node.id, !isExpanded);
  };

  const getRangeSelection = (fromId: string, toId: string) => {
    const fromIndex = selectableNodeIds.indexOf(fromId);
    const toIndex = selectableNodeIds.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1) {
      return [toId];
    }
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    return selectableNodeIds.slice(start, end + 1);
  };

  const handleSelect = (node: TreeNode, event: ReactMouseEvent) => {
    const selectable = selectionMode !== "none" && node.selectable !== false;
    if (!selectable) return;

    if (selectionMode === "single") {
      setSelection([node.id]);
      setLastSelectedId(node.id);
      return;
    }

    const metaPressed = event.metaKey || event.ctrlKey;
    const shiftPressed = event.shiftKey;

    if (shiftPressed && lastSelectedId) {
      const range = getRangeSelection(lastSelectedId, node.id);
      if (metaPressed) {
        const merged = new Set(resolvedSelectedIds);
        range.forEach((id) => merged.add(id));
        setSelection(Array.from(merged));
      } else {
        setSelection(range);
      }
      setLastSelectedId(node.id);
      return;
    }

    if (metaPressed) {
      const next = new Set(resolvedSelectedIds);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      setSelection(Array.from(next));
      setLastSelectedId(node.id);
      return;
    }

    setSelection([node.id]);
    setLastSelectedId(node.id);
  };

  const handleContextMenu = (node: TreeNode, event: ReactMouseEvent) => {
    if (!node.contextMenu?.length) return;
    event.preventDefault();
    event.stopPropagation();

    const selectable = selectionMode !== "none" && node.selectable !== false;
    if (selectable && !resolvedSelectedIds.includes(node.id)) {
      setSelection([node.id]);
      setLastSelectedId(node.id);
    }

    setContextMenu({
      items: node.contextMenu,
      position: { x: event.clientX, y: event.clientY },
      node,
    });
  };

    const renderNode = (node: TreeNode, depth = 0) => {
    if (node.variant === "load-more") {
      return (
        <div
          key={node.id}
          className="tree-node tree-node--load-more"
          role="treeitem"
        >
          <div
            className="tree-row tree-row--load-more"
            style={{ paddingLeft: `${depth * 12 + 28}px` }}
            onClick={(event) => {
              if (node.isLoading) return;
              handleSelect(node, event);
              onNodeActivate?.(node);
            }}
          >
            {node.isLoading ? (
              <Icon name="refresh" size={14} className="icon-spin" />
            ) : (
              <Icon name="plus" size={14} />
            )}
            <span className="tree-node-label">
              {node.isLoading ? "Loading..." : node.label}
            </span>
          </div>
        </div>
      );
    }

    const hasChildren = Boolean(node.children?.length);
    const isExpanded = expandedNodes.has(node.id);
    const isSelected =
      selectionMode !== "none" && resolvedSelectedIds.includes(node.id);
    const selectable = selectionMode !== "none" && node.selectable !== false;

    return (
      <div
        key={node.id}
        className={`tree-node ${depth === 0 ? "tree-node--root" : "tree-node--nested"}`}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={selectable ? isSelected : undefined}
      >
        <div
          className={`tree-row ${isSelected ? "tree-row--selected" : ""}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          tabIndex={selectable ? 0 : -1}
          onClick={(event) => {
            if (toggleOnRowClick && selectionMode === "none" && hasChildren) {
              toggleExpanded(node);
              return;
            }
            handleSelect(node, event);
          }}
          onDoubleClick={() => onNodeActivate?.(node)}
          onContextMenu={(event) => handleContextMenu(node, event)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="tree-toggle"
              aria-label={isExpanded ? "Collapse" : "Expand"}
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded(node);
              }}
            >
              <Icon name={isExpanded ? "chevronDown" : "chevronRight"} size={14} />
            </button>
          ) : (
            <span className="tree-toggle-placeholder" aria-hidden />
          )}

          {node.icon ? (
            <Icon name={node.icon} size={14} className="tree-node-icon" />
          ) : null}

          <div className="tree-node-body">
            <span className="tree-node-label">{node.label}</span>
            {node.description ? (
              <span className="tree-node-description">{node.description}</span>
            ) : null}
          </div>

          <div className="tree-node-right">
            {renderRightSlot ? renderRightSlot(node) : node.rightSlot}
            {renderActions ? (
              <div className="tree-actions">{renderActions(node)}</div>
            ) : null}
            {node.actions?.length ? (
              <div className="tree-actions">
                {node.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={`icon-button icon-button--tiny ${
                      action.intent === "danger" ? "icon-button--danger" : ""
                    }`}
                    title={action.label}
                    disabled={action.disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <Icon name={action.icon} size={12} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {hasChildren && isExpanded ? (
          <div className="tree-children" role="group">
            {node.children?.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="tree-view" role="tree">
      {nodes.map((node) => renderNode(node))}
      {contextMenu ? (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onSelect={(itemId) => onContextMenuSelect?.(contextMenu.node, itemId)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
}
