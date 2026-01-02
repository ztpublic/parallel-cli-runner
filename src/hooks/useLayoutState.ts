import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayoutNode, Orientation, PaneNode } from "../types/layout";
import {
  appendPaneToLayout,
  collectPanes,
  countPanes,
  createId,
  findPane,
  getFirstPane,
  getLayoutOrientation,
  removePane,
  splitPane,
} from "../types/layout";
import { killSession, writeToSession } from "../services/tauri";
import { disposeTerminal } from "../services/terminalRegistry";
import { killLayoutSessions } from "../services/sessions";

export function useLayoutState() {
  const [tabs, setTabs] = useState<
    {
      id: string;
      title: string;
      layout: LayoutNode;
      activePaneId: string | null;
    }[]
  >([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    if (!tabs.length) {
      if (activeTabId !== null) {
        setActiveTabId(null);
      }
      return;
    }
    if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  const activeTab = useMemo(() => {
    if (!tabs.length) return null;
    if (!activeTabId) return tabs[0];
    return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  }, [tabs, activeTabId]);

  const layout = activeTab?.layout ?? null;
  const activePaneId = activeTab?.activePaneId ?? null;

  const getActiveTabId = useCallback(
    () => activeTabIdRef.current ?? tabsRef.current[0]?.id ?? null,
    []
  );

  const setActivePaneId = useCallback(
    (paneId: string | null) => {
      const tabId = getActiveTabId();
      if (!tabId) return;
      setTabs((prev) =>
        prev.map((tab) => (tab.id === tabId ? { ...tab, activePaneId: paneId } : tab))
      );
    },
    [getActiveTabId]
  );

  const appendPane = useCallback((pane: PaneNode, title?: string) => {
    const tabId = createId();
    const tabTitle =
      title ?? pane.meta?.title ?? `Terminal ${tabsRef.current.length + 1}`;
    setTabs((prev) => [
      ...prev,
      {
        id: tabId,
        title: tabTitle,
        layout: pane,
        activePaneId: pane.id,
      },
    ]);
    setActiveTabId(tabId);
  }, []);

  const splitPaneInLayout = useCallback(
    (pane: PaneNode, targetPaneId: string, orientation: Orientation) => {
      const tabId = getActiveTabId();
      if (!tabId) return;
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== tabId) return tab;
          const nextLayout = splitPane(tab.layout, targetPaneId, pane, orientation);
          const resolvedLayout =
            nextLayout === tab.layout
              ? appendPaneToLayout(tab.layout, pane, getLayoutOrientation(tab.layout))
              : nextLayout;
          return {
            ...tab,
            layout: resolvedLayout ?? pane,
            activePaneId: pane.id,
          };
        })
      );
    },
    [getActiveTabId]
  );

  const splitPaneInTab = useCallback(
    (tabId: string, pane: PaneNode, targetPaneId: string, orientation: Orientation) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== tabId) return tab;
          const nextLayout = splitPane(tab.layout, targetPaneId, pane, orientation);
          const resolvedLayout =
            nextLayout === tab.layout
              ? appendPaneToLayout(tab.layout, pane, getLayoutOrientation(tab.layout))
              : nextLayout;
          return {
            ...tab,
            layout: resolvedLayout ?? pane,
            activePaneId: pane.id,
          };
        })
      );
    },
    []
  );

  const closeTab = useCallback((tabId: string) => {
    const currentTabs = tabsRef.current;
    const tabIndex = currentTabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) return;

    const tab = currentTabs[tabIndex];
    const nextTabs = currentTabs.filter((item) => item.id !== tabId);
    setTabs(nextTabs);

    if (activeTabIdRef.current === tabId) {
      const fallbackTab = nextTabs[tabIndex - 1] ?? nextTabs[tabIndex] ?? nextTabs[0];
      setActiveTabId(fallbackTab?.id ?? null);
    }

    void killLayoutSessions(tab.layout);
  }, []);

  const closePane = useCallback(
    async (paneId: string) => {
      const tabId = getActiveTabId();
      if (!tabId) return;
      const tab = tabsRef.current.find((item) => item.id === tabId);
      if (!tab) return;

      const paneToRemove = findPane(tab.layout, paneId);
      if (!paneToRemove) return;

      if (countPanes(tab.layout) === 1) {
        closeTab(tabId);
        return;
      }

      await killSession({ id: paneToRemove.sessionId });
      disposeTerminal(paneToRemove.sessionId);

      setTabs((prev) =>
        prev.map((item) => {
          if (item.id !== tabId) return item;
          const nextLayout = removePane(item.layout, paneId);
          if (!nextLayout) return item;
          const nextActivePaneId =
            item.activePaneId === paneId
              ? getFirstPane(nextLayout)?.id ?? null
              : item.activePaneId;
          return { ...item, layout: nextLayout, activePaneId: nextActivePaneId };
        })
      );
    },
    [closeTab, getActiveTabId]
  );

  const closePaneInTab = useCallback(
    async (tabId: string, paneId: string) => {
      const tab = tabsRef.current.find((item) => item.id === tabId);
      if (!tab) return;

      const paneToRemove = findPane(tab.layout, paneId);
      if (!paneToRemove) return;

      if (countPanes(tab.layout) === 1) {
        closeTab(tabId);
        return;
      }

      await killSession({ id: paneToRemove.sessionId });
      disposeTerminal(paneToRemove.sessionId);

      setTabs((prev) =>
        prev.map((item) => {
          if (item.id !== tabId) return item;
          const nextLayout = removePane(item.layout, paneId);
          if (!nextLayout) return item;
          const nextActivePaneId =
            item.activePaneId === paneId
              ? getFirstPane(nextLayout)?.id ?? null
              : item.activePaneId;
          return { ...item, layout: nextLayout, activePaneId: nextActivePaneId };
        })
      );
    },
    [closeTab]
  );

  const closeActivePane = useCallback(async () => {
    const tabId = getActiveTabId();
    if (!tabId) return;
    const tab = tabsRef.current.find((item) => item.id === tabId);
    if (!tab?.activePaneId) return;
    await closePane(tab.activePaneId);
  }, [closePane, getActiveTabId]);

  const getTabsSnapshot = useCallback(() => tabsRef.current, []);

  const broadcastPaneInput = useCallback(
    (pane: PaneNode, data: string) => {
      const tabId = getActiveTabId();
      if (!tabId) return;
      const tab = tabsRef.current.find((item) => item.id === tabId);
      if (!tab) return;
      const targetSessions = collectPanes(tab.layout)
        .map((p) => p.sessionId)
        .filter((id) => id !== pane.sessionId);
      if (!targetSessions.length) return;
      targetSessions.forEach((id) => {
        void writeToSession({ id, data });
      });
    },
    [getActiveTabId]
  );

  return {
    tabs,
    activeTabId,
    setActiveTabId,
    layout,
    activePaneId,
    setActivePaneId,
    appendPane,
    splitPaneInLayout,
    splitPaneInTab,
    closePane,
    closePaneInTab,
    closeActivePane,
    closeTab,
    getTabsSnapshot,
    broadcastPaneInput,
  };
}
