import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GitTab, GitTabId } from "../../types/git-ui";

export function useGitTabs(initialTabs: GitTab[]) {
  const [tabs, setTabs] = useState<GitTab[]>(initialTabs);
  const [activeTab, setActiveTab] = useState<GitTabId>("branches");
  const [draggedTabId, setDraggedTabId] = useState<GitTabId | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<GitTabId | null>(null);
  const draggedTabRef = useRef<GitTabId | null>(null);
  const lastPointerTargetRef = useRef<{ id: GitTabId; side: "before" | "after" } | null>(
    null
  );
  const pointerCaptureRef = useRef<{ element: HTMLButtonElement; pointerId: number } | null>(
    null
  );

  useEffect(() => {
    draggedTabRef.current = draggedTabId;
  }, [draggedTabId]);

  const moveTab = useCallback((sourceTabId: GitTabId, targetTabId: GitTabId, isAfter: boolean) => {
    setTabs((current) => {
      const sourceIndex = current.findIndex((tab) => tab.id === sourceTabId);
      const targetIndex = current.findIndex((tab) => tab.id === targetTabId);
      if (sourceIndex === -1 || targetIndex === -1) return current;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      const insertIndex = targetIndex + (isAfter ? 1 : 0);
      const normalizedIndex = sourceIndex < insertIndex ? insertIndex - 1 : insertIndex;
      next.splice(normalizedIndex, 0, moved);
      return next;
    });
  }, []);

  const handleDragStart = (tabId: GitTabId) => (event: DragEvent<HTMLButtonElement>) => {
    const { dataTransfer } = event;
    if (dataTransfer) {
      dataTransfer.effectAllowed = "move";
      try {
        dataTransfer.setData("text/plain", tabId);
      } catch {
        // Some webviews block dataTransfer writes; fall back to state tracking.
      }
    }
    setDraggedTabId(tabId);
  };

  const handleDragOver = (tabId: GitTabId) => (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
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

    moveTab(sourceTabId, tabId, isAfter);

    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const sourceTabId = draggedTabRef.current;
      if (!sourceTabId) return;

      const targetEl = document.elementFromPoint(event.clientX, event.clientY);
      const targetButton = targetEl?.closest("button[data-git-tab-id]") as
        | HTMLButtonElement
        | null;
      const targetId = targetButton?.dataset.gitTabId as GitTabId | undefined;

      if (!targetId) {
        setDragOverTabId(null);
        return;
      }

      const { left, width } = targetButton.getBoundingClientRect();
      const side = event.clientX >= left + width / 2 ? "after" : "before";

      if (targetId === sourceTabId) {
        setDragOverTabId(targetId);
        lastPointerTargetRef.current = { id: targetId, side };
        return;
      }

      if (
        lastPointerTargetRef.current?.id === targetId &&
        lastPointerTargetRef.current?.side === side
      ) {
        setDragOverTabId(targetId);
        return;
      }

      lastPointerTargetRef.current = { id: targetId, side };
      setDragOverTabId(targetId);
      moveTab(sourceTabId, targetId, side === "after");
    },
    [moveTab]
  );

  const handlePointerEnd = useCallback(() => {
    if (pointerCaptureRef.current) {
      const { element, pointerId } = pointerCaptureRef.current;
      try {
        element.releasePointerCapture(pointerId);
      } catch {
        // Ignore release errors; capture may not be active in some webviews.
      }
      pointerCaptureRef.current = null;
    }
    draggedTabRef.current = null;
    lastPointerTargetRef.current = null;
    handleDragEnd();
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerEnd);
    window.removeEventListener("pointercancel", handlePointerEnd);
  }, [handlePointerMove]);

  const handlePointerDown =
    (tabId: GitTabId) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerCaptureRef.current = {
          element: event.currentTarget,
          pointerId: event.pointerId,
        };
      } catch {
        pointerCaptureRef.current = null;
      }
      setDraggedTabId(tabId);
      draggedTabRef.current = tabId;
      setDragOverTabId(tabId);
      lastPointerTargetRef.current = null;

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerEnd);
      window.addEventListener("pointercancel", handlePointerEnd);
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
    handlePointerDown,
  };
}
