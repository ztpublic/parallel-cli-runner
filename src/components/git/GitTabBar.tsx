import { DragEvent } from "react";
import { Icon } from "../Icons";
import { GitTab, GitTabId } from "../../types/git-ui";

type GitTabBarProps = {
  tabs: GitTab[];
  activeTab: GitTabId;
  draggedTabId: GitTabId | null;
  dragOverTabId: GitTabId | null;
  onTabClick: (id: GitTabId) => void;
  onDragStart: (id: GitTabId) => (event: DragEvent<HTMLButtonElement>) => void;
  onDragOver: (id: GitTabId) => (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (id: GitTabId) => (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
};

export function GitTabBar({
  tabs,
  activeTab,
  draggedTabId,
  dragOverTabId,
  onTabClick,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: GitTabBarProps) {
  return (
    <div className="git-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`git-tab ${activeTab === tab.id ? "is-active" : ""} ${
            draggedTabId === tab.id ? "is-dragging" : ""
          } ${dragOverTabId === tab.id ? "is-drag-over" : ""}`}
          role="tab"
          aria-selected={activeTab === tab.id}
          draggable
          onClick={() => onTabClick(tab.id)}
          onDragStart={onDragStart(tab.id)}
          onDragOver={onDragOver(tab.id)}
          onDrop={onDrop(tab.id)}
          onDragEnd={onDragEnd}
        >
          <Icon name={tab.icon} size={14} />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
