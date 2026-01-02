import type { DragEvent, PointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { Icon } from "../Icons";
import { GitTab, GitTabId } from "../../types/git-ui";

type GitTabGroup = "top" | "bottom" | "single";

type GitTabBarProps = {
  tabs: GitTab[];
  activeTab: GitTabId;
  draggedTabId: GitTabId | null;
  dragOverTabId: GitTabId | null;
  dragOverGroup: GitTabGroup | null;
  groupId?: GitTabGroup;
  onTabClick: (id: GitTabId) => void;
  onTabContextMenu?: (id: GitTabId, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onDragStart: (id: GitTabId) => (event: DragEvent<HTMLButtonElement>) => void;
  onDragOver: (id: GitTabId) => (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (id: GitTabId) => (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onPointerDown: (id: GitTabId) => (event: PointerEvent<HTMLButtonElement>) => void;
};

export function GitTabBar({
  tabs,
  activeTab,
  draggedTabId,
  dragOverTabId,
  dragOverGroup,
  groupId = "single",
  onTabClick,
  onTabContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onPointerDown,
}: GitTabBarProps) {
  const isTauri =
    typeof window !== "undefined" &&
    typeof (window as Window & { __TAURI__?: unknown }).__TAURI__ !== "undefined";
  const isDraggable = !isTauri;

  return (
    <div className="git-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          data-git-tab-id={tab.id}
          data-git-tab-group={groupId}
          type="button"
          className={`git-tab ${activeTab === tab.id ? "is-active" : ""} ${
            draggedTabId === tab.id ? "is-dragging" : ""
          } ${
            dragOverTabId === tab.id && dragOverGroup === groupId ? "is-drag-over" : ""
          }`}
          role="tab"
          aria-selected={activeTab === tab.id}
          draggable={isDraggable}
          onClick={() => onTabClick(tab.id)}
          onContextMenu={
            onTabContextMenu
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onTabContextMenu(tab.id, event);
                }
              : undefined
          }
          onDragStart={isDraggable ? onDragStart(tab.id) : undefined}
          onDragOver={isDraggable ? onDragOver(tab.id) : undefined}
          onDrop={isDraggable ? onDrop(tab.id) : undefined}
          onDragEnd={isDraggable ? onDragEnd : undefined}
          onPointerDown={onPointerDown(tab.id)}
        >
          <Icon name={tab.icon} size={14} />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
