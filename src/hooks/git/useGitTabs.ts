import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitTab, GitTabId } from "../../types/git-ui";

type GitTabGroup = "top" | "bottom" | "single";

type PointerTarget = {
  id: GitTabId;
  side: "before" | "after";
  group: GitTabGroup;
};

const defaultBottomTabs = new Set<GitTabId>([
  "commits",
  "commit",
  "stashes",
  "remotes",
]);

const createGroupMap = (tabs: GitTab[]) => {
  const map = {} as Record<GitTabId, "top" | "bottom">;
  tabs.forEach((tab) => {
    map[tab.id] = defaultBottomTabs.has(tab.id) ? "bottom" : "top";
  });

  const hasTop = tabs.some((tab) => map[tab.id] === "top");
  const hasBottom = tabs.some((tab) => map[tab.id] === "bottom");

  if (!hasTop && tabs[0]) {
    map[tabs[0].id] = "top";
  }
  if (!hasBottom && tabs[tabs.length - 1]) {
    map[tabs[tabs.length - 1].id] = "bottom";
  }

  return map;
};

const getFirstTabId = (tabs: GitTab[]) => tabs[0]?.id ?? "branches";

export function useGitTabs(initialTabs: GitTab[]) {
  const [tabs, setTabs] = useState<GitTab[]>(initialTabs);
  const [tabGroups, setTabGroups] = useState<Record<GitTabId, "top" | "bottom">>(() =>
    createGroupMap(initialTabs)
  );
  const [activeTab, setActiveTab] = useState<GitTabId>("branches");
  const [activeTopTab, setActiveTopTab] = useState<GitTabId>(() => {
    const groupMap = createGroupMap(initialTabs);
    return (
      initialTabs.find((tab) => groupMap[tab.id] === "top")?.id ??
      getFirstTabId(initialTabs)
    );
  });
  const [activeBottomTab, setActiveBottomTab] = useState<GitTabId>(() => {
    const groupMap = createGroupMap(initialTabs);
    return (
      initialTabs.find((tab) => groupMap[tab.id] === "bottom")?.id ??
      getFirstTabId(initialTabs)
    );
  });
  const [draggedTabId, setDraggedTabId] = useState<GitTabId | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<GitTabGroup | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<GitTabId | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<GitTabGroup | null>(null);
  const draggedTabRef = useRef<GitTabId | null>(null);
  const draggedGroupRef = useRef<GitTabGroup | null>(null);
  const lastPointerTargetRef = useRef<PointerTarget | null>(null);
  const pointerCaptureRef = useRef<{ element: HTMLButtonElement; pointerId: number } | null>(
    null
  );

  const topTabs = useMemo(
    () => tabs.filter((tab) => tabGroups[tab.id] !== "bottom"),
    [tabs, tabGroups]
  );
  const bottomTabs = useMemo(
    () => tabs.filter((tab) => tabGroups[tab.id] === "bottom"),
    [tabs, tabGroups]
  );

  useEffect(() => {
    draggedTabRef.current = draggedTabId;
  }, [draggedTabId]);

  useEffect(() => {
    draggedGroupRef.current = draggedGroup;
  }, [draggedGroup]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab) && tabs[0]) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    if (!topTabs.some((tab) => tab.id === activeTopTab) && topTabs[0]) {
      setActiveTopTab(topTabs[0].id);
    }
  }, [activeTopTab, topTabs]);

  useEffect(() => {
    if (!bottomTabs.some((tab) => tab.id === activeBottomTab) && bottomTabs[0]) {
      setActiveBottomTab(bottomTabs[0].id);
    }
  }, [activeBottomTab, bottomTabs]);

  const moveTab = useCallback(
    (
      sourceTabId: GitTabId,
      targetTabId: GitTabId,
      isAfter: boolean,
      targetGroup: GitTabGroup
    ) => {
      const sourceGroup = tabGroups[sourceTabId] ?? "top";
      if (targetGroup !== "single" && sourceGroup !== targetGroup) {
        return;
      }

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
    },
    [tabGroups]
  );

  const moveTabToGroup = useCallback(
    (tabId: GitTabId, targetGroup: Exclude<GitTabGroup, "single">) => {
      const sourceGroup = tabGroups[tabId] ?? "top";
      if (sourceGroup === targetGroup) return;
      const sourceGroupCount = tabs.filter((tab) => tabGroups[tab.id] === sourceGroup).length;
      if (sourceGroupCount <= 1) return;

      setTabGroups((current) => ({ ...current, [tabId]: targetGroup }));
    },
    [tabGroups, tabs]
  );

  const handleDragStart =
    (group: GitTabGroup, tabId: GitTabId) => (event: DragEvent<HTMLButtonElement>) => {
      const { dataTransfer } = event;
      if (dataTransfer) {
        dataTransfer.effectAllowed = "move";
        try {
          dataTransfer.setData("text/plain", `${group}|${tabId}`);
        } catch {
          // Some webviews block dataTransfer writes; fall back to state tracking.
        }
      }
      setDraggedTabId(tabId);
      setDraggedGroup(group);
      draggedTabRef.current = tabId;
      draggedGroupRef.current = group;
      lastPointerTargetRef.current = null;
    };

  const handleDragOver =
    (group: GitTabGroup, tabId: GitTabId) => (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      if (draggedGroupRef.current && draggedGroupRef.current !== group) {
        setDragOverTabId(null);
        setDragOverGroup(null);
        return;
      }
      setDragOverTabId(tabId);
      setDragOverGroup(group);

      const sourceTabId = draggedTabRef.current;
      if (!sourceTabId || sourceTabId === tabId) {
        return;
      }

      const { left, width } = event.currentTarget.getBoundingClientRect();
      const side = event.clientX >= left + width / 2 ? "after" : "before";

      if (
        lastPointerTargetRef.current?.id === tabId &&
        lastPointerTargetRef.current?.side === side &&
        lastPointerTargetRef.current?.group === group
      ) {
        return;
      }

      lastPointerTargetRef.current = { id: tabId, side, group };
      moveTab(sourceTabId, tabId, side === "after", group);
    };

  const handleDrop =
    (group: GitTabGroup, tabId: GitTabId) => (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const payload = event.dataTransfer.getData("text/plain");
      const [payloadGroup, payloadTabId] = payload.split("|") as [GitTabGroup, GitTabId];
      const sourceTabId = payloadTabId || draggedTabId;
      const sourceGroup = payloadTabId ? payloadGroup : draggedGroup;

      if (!sourceTabId || sourceTabId === tabId) {
        setDragOverTabId(null);
        setDragOverGroup(null);
        return;
      }

      if (sourceGroup && group !== sourceGroup && sourceGroup !== "single") {
        setDragOverTabId(null);
        setDragOverGroup(null);
        return;
      }

      const { left, width } = event.currentTarget.getBoundingClientRect();
      const isAfter = event.clientX >= left + width / 2;

      moveTab(sourceTabId, tabId, isAfter, group ?? sourceGroup ?? "single");

      setDragOverTabId(null);
      setDragOverGroup(null);
    };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDraggedGroup(null);
    setDragOverTabId(null);
    setDragOverGroup(null);
    lastPointerTargetRef.current = null;
  };

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const sourceTabId = draggedTabRef.current;
      if (!sourceTabId) return;

      const elements = document.elementsFromPoint(event.clientX, event.clientY);
      const buttons = elements
        .map((element) => element.closest("button[data-git-tab-id]"))
        .filter((element): element is HTMLButtonElement => element !== null);
      let targetButton =
        buttons.find((button) => button.dataset.gitTabId !== sourceTabId) ?? buttons[0];
      if (!targetButton) {
        const candidates = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button[data-git-tab-id]")
        );
        targetButton = candidates.find((button) => {
          const rect = button.getBoundingClientRect();
          return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );
        });
      }
      const targetId = targetButton?.dataset.gitTabId as GitTabId | undefined;
      const targetGroup = targetButton?.dataset.gitTabGroup as GitTabGroup | undefined;

      if (!targetButton || !targetId || !targetGroup) {
        setDragOverTabId(null);
        setDragOverGroup(null);
        return;
      }

      const sourceGroup = draggedGroupRef.current ?? "single";
      if (sourceGroup !== "single" && targetGroup !== sourceGroup) {
        setDragOverTabId(null);
        setDragOverGroup(null);
        return;
      }

      const { left, width } = targetButton.getBoundingClientRect();
      const side = event.clientX >= left + width / 2 ? "after" : "before";

      if (targetId === sourceTabId) {
        setDragOverTabId(targetId);
        setDragOverGroup(targetGroup);
        lastPointerTargetRef.current = { id: targetId, side, group: targetGroup };
        return;
      }

      if (
        lastPointerTargetRef.current?.id === targetId &&
        lastPointerTargetRef.current?.side === side &&
        lastPointerTargetRef.current?.group === targetGroup
      ) {
        setDragOverTabId(targetId);
        setDragOverGroup(targetGroup);
        return;
      }

      lastPointerTargetRef.current = { id: targetId, side, group: targetGroup };
      setDragOverTabId(targetId);
      setDragOverGroup(targetGroup);
      moveTab(sourceTabId, targetId, side === "after", targetGroup);
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
    draggedGroupRef.current = null;
    lastPointerTargetRef.current = null;
    handleDragEnd();
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerEnd);
    window.removeEventListener("pointercancel", handlePointerEnd);
  }, [handlePointerMove]);

  const handlePointerDown =
    (group: GitTabGroup, tabId: GitTabId) => (event: ReactPointerEvent<HTMLButtonElement>) => {
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
      setDraggedGroup(group);
      draggedTabRef.current = tabId;
      draggedGroupRef.current = group;
      setDragOverTabId(tabId);
      setDragOverGroup(group);
      lastPointerTargetRef.current = null;

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerEnd);
      window.addEventListener("pointercancel", handlePointerEnd);
    };

  useEffect(() => {
    return () => {
      if (pointerCaptureRef.current) {
        const { element, pointerId } = pointerCaptureRef.current;
        try {
          element.releasePointerCapture(pointerId);
        } catch {
          // Ignore release errors; capture may not be active in some webviews.
        }
        pointerCaptureRef.current = null;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      draggedTabRef.current = null;
      draggedGroupRef.current = null;
      lastPointerTargetRef.current = null;
      setDraggedTabId(null);
      setDraggedGroup(null);
      setDragOverTabId(null);
      setDragOverGroup(null);
    };
  }, [handlePointerEnd, handlePointerMove]);

  return {
    tabs,
    tabGroups,
    topTabs,
    bottomTabs,
    activeTab,
    setActiveTab,
    activeTopTab,
    setActiveTopTab,
    activeBottomTab,
    setActiveBottomTab,
    draggedTabId,
    dragOverTabId,
    dragOverGroup,
    moveTabToGroup,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handlePointerDown,
  };
}
