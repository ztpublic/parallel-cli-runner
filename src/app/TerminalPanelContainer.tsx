import { useCallback, useEffect, useState } from "react";
import { TerminalPanel } from "../components/TerminalPanel";
import { createPaneNode } from "../services/sessions";
import { collectPanes, countPanes, findPane, getFirstPane, type LayoutNode, type Orientation, type PaneNode } from "../types/layout";

type Tab = {
  id: string;
  title: string;
  layout: LayoutNode;
  activePaneId: string | null;
};

interface TerminalPanelContainerProps {
  tabs: Tab[];
  activeTabId: string | null | undefined;
  closeTab: (tabId: string) => void;
  closePanesInTab: (tabId: string, paneIds: string[]) => Promise<void>;
  splitPaneInTab: (
    tabId: string,
    pane: PaneNode,
    targetPaneId: string,
    orientation: Orientation
  ) => void;
  appendPane: (pane: PaneNode, title?: string) => void;
  setActiveTabId: (tabId: string) => void;
  setActivePaneId: (paneId: string) => void;
}

export function TerminalPanelContainer({
  tabs,
  activeTabId,
  closeTab,
  closePanesInTab,
  splitPaneInTab,
  appendPane,
  setActiveTabId,
  setActivePaneId,
}: TerminalPanelContainerProps) {
  const [terminalSplitPaneIds, setTerminalSplitPaneIds] = useState<
    Record<string, string[]>
  >({});
  const [terminalSplitViews, setTerminalSplitViews] = useState<
    Record<string, "single" | "vertical" | "horizontal" | "quad">
  >({});
  const [terminalLayoutTick, setTerminalLayoutTick] = useState(0);

  // Cleanup split state when tabs are removed
  useEffect(() => {
    setTerminalSplitPaneIds((prev) => {
      let changed = false;
      const next = { ...prev };
      const tabIds = new Set(tabs.map((tab) => tab.id));
      Object.keys(next).forEach((tabId) => {
        if (!tabIds.has(tabId)) {
          delete next[tabId];
          changed = true;
        }
      });
      tabs.forEach((tab) => {
        const splitPaneIds = prev[tab.id] ?? [];
        if (!splitPaneIds.length) return;
        const nextIds = splitPaneIds.filter((id) => findPane(tab.layout, id));
        if (nextIds.length !== splitPaneIds.length) {
          next[tab.id] = nextIds;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setTerminalSplitViews((prev) => {
      let changed = false;
      const next = { ...prev };
      const tabIds = new Set(tabs.map((tab) => tab.id));
      Object.keys(next).forEach((tabId) => {
        if (!tabIds.has(tabId)) {
          delete next[tabId];
          changed = true;
        }
      });
      tabs.forEach((tab) => {
        const splitPaneIds = terminalSplitPaneIds[tab.id] ?? [];
        if (!splitPaneIds.length && next[tab.id] && next[tab.id] !== "single") {
          next[tab.id] = "single";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [tabs, terminalSplitPaneIds]);

  const handleNewPane = useCallback(async () => {
    const nextIndex = tabs.length + 1;
    const title = `Terminal ${nextIndex}`;
    const next = await createPaneNode({
      meta: {
        title,
      },
    });
    appendPane(next, title);
  }, [appendPane, tabs.length]);

  const handleSetTerminalView = useCallback(
    async (tabId: string, view: "single" | "vertical" | "horizontal" | "quad") => {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab) return;

      const existingView = terminalSplitViews[tabId] ?? "single";
      if (view === existingView) return;

      const splitPaneIds = terminalSplitPaneIds[tabId] ?? [];
      if (splitPaneIds.length) {
        await closePanesInTab(tabId, splitPaneIds);
      }

      if (view === "single") {
        setTerminalSplitPaneIds((prev) => ({ ...prev, [tabId]: [] }));
        setTerminalSplitViews((prev) => ({ ...prev, [tabId]: "single" }));
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
        setTerminalLayoutTick((tick) => tick + 1);
        return;
      }

      let targetPaneId = tab.activePaneId;
      if (splitPaneIds.length) {
        const allPanes = collectPanes(tab.layout);
        const survivor = allPanes.find((p) => !splitPaneIds.includes(p.id));
        if (survivor) {
          targetPaneId = survivor.id;
        }
      }
      if (!targetPaneId) targetPaneId = getFirstPane(tab.layout)?.id ?? null;

      if (!targetPaneId) return;
      const paneId = targetPaneId;
      const targetPane = findPane(tab.layout, paneId);
      const cwd = targetPane?.meta?.cwd ?? targetPane?.meta?.subtitle;
      const subtitle = targetPane?.meta?.subtitle;
      const baseIndex = countPanes(tab.layout);

      const createSplitPane = async (indexOffset: number) =>
        createPaneNode({
          cwd,
          meta: {
            title: `Terminal ${baseIndex + indexOffset}`,
            subtitle,
            cwd,
          },
        });

      if (view === "vertical" || view === "horizontal") {
        const next = await createSplitPane(1);
        splitPaneInTab(tabId, next, paneId, view === "vertical" ? "vertical" : "horizontal");
        setTerminalSplitPaneIds((prev) => ({ ...prev, [tabId]: [next.id] }));
        setTerminalSplitViews((prev) => ({ ...prev, [tabId]: view }));
      } else {
        const paneA = await createSplitPane(1);
        splitPaneInTab(tabId, paneA, paneId, "vertical");

        const paneB = await createSplitPane(2);
        splitPaneInTab(tabId, paneB, paneId, "horizontal");

        const paneC = await createSplitPane(3);
        splitPaneInTab(tabId, paneC, paneA.id, "horizontal");

        setTerminalSplitPaneIds((prev) => ({
          ...prev,
          [tabId]: [paneA.id, paneB.id, paneC.id],
        }));
        setTerminalSplitViews((prev) => ({ ...prev, [tabId]: "quad" }));
      }

      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
      setTerminalLayoutTick((tick) => tick + 1);
    },
    [closePanesInTab, splitPaneInTab, tabs, terminalSplitPaneIds, terminalSplitViews]
  );

  const resolvedActiveTabId = activeTabId ?? tabs[0]?.id ?? null;

  return (
    <TerminalPanel
      tabs={tabs}
      activeTabId={resolvedActiveTabId}
      terminalSplitPaneIds={terminalSplitPaneIds}
      terminalSplitViews={terminalSplitViews}
      layoutTick={terminalLayoutTick}
      onSetActiveTab={setActiveTabId}
      onSetActivePane={setActivePaneId}
      onCloseTab={(id) => closeTab(id)}
      onNewPane={() => void handleNewPane()}
      onSetTerminalView={(tabId, view) => void handleSetTerminalView(tabId, view)}
    />
  );
}
