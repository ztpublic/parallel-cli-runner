import { useState, DragEvent } from "react";
import { GitTab, GitTabId } from "../../types/git-ui";

export function useGitTabs(initialTabs: GitTab[]) {
  const [tabs, setTabs] = useState<GitTab[]>(initialTabs);
  const [activeTab, setActiveTab] = useState<GitTabId>("branches");
  const [draggedTabId, setDraggedTabId] = useState<GitTabId | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<GitTabId | null>(null);

  const handleDragStart = (tabId: GitTabId) => (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tabId);
    setDraggedTabId(tabId);
  };

  const handleDragOver = (tabId: GitTabId) => (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOverTabId(tabId);
  };

  const handleDrop = (tabId: GitTabId) => (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") as GitTabId | "";
    const sourceTabId = sourceId || draggedTabId;

    if (!sourceTabId || sourceTabId === tabId) {
      setDragOverTabId(null);
      return;
    }

    const { left, width } = event.currentTarget.getBoundingClientRect();
    const isAfter = event.clientX >= left + width / 2;

    setTabs((current) => {
      const sourceIndex = current.findIndex((tab) => tab.id === sourceTabId);
      const targetIndex = current.findIndex((tab) => tab.id === tabId);
      if (sourceIndex === -1 || targetIndex === -1) return current;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      const insertIndex = targetIndex + (isAfter ? 1 : 0);
      const normalizedIndex = sourceIndex < insertIndex ? insertIndex - 1 : insertIndex;
      next.splice(normalizedIndex, 0, moved);
      return next;
    });

    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  return {
    tabs,
    activeTab,
    setActiveTab,
    draggedTabId,
    dragOverTabId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}
