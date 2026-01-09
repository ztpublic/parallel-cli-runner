import { useCallback, useEffect, useState } from "react";
import { TerminalPanel } from "../components/TerminalPanel";
import { createPaneNode, createAgentPaneNode, convertEmptyPane } from "../services/sessions";
import { killSession } from "../services/backend";
import { disposeTerminal } from "../services/terminalRegistry";
import { collectPanes, findPane, getFirstPane, createEmptyPane, countPanes, type LayoutNode, type Orientation, type PaneNode } from "../types/layout";
import type { RepoInfoDto } from "../types/git";
import type { WorktreeItem } from "../types/git-ui";

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
  closeActivePane: () => void;
  splitPaneInTab: (
    tabId: string,
    pane: PaneNode,
    targetPaneId: string,
    orientation: Orientation
  ) => void;
  appendPane: (pane: PaneNode, title?: string) => void;
  updatePaneInTab: (tabId: string, paneId: string, updatedPane: PaneNode) => void;
  setActiveTabId: (tabId: string) => void;
  setActivePaneId: (paneId: string) => void;
  repos?: RepoInfoDto[];
  worktreesByRepo?: Record<string, WorktreeItem[]>;
}

export function TerminalPanelContainer({
  tabs,
  activeTabId,
  closeTab,
  closePanesInTab,
  closeActivePane,
  splitPaneInTab,
  appendPane,
  updatePaneInTab,
  setActiveTabId,
  setActivePaneId,
  repos = [],
  worktreesByRepo = {},
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

      // Get the source pane to preserve its directory context
      const sourcePane = findPane(tab.layout, paneId);
      const sourceMeta = sourcePane?.meta;

      // Create empty panes for split (user will choose Terminal or Agent)
      const createEmptySplitPane = () => createEmptyPane("terminal", sourceMeta);

      if (view === "vertical" || view === "horizontal") {
        const next = createEmptySplitPane();
        splitPaneInTab(tabId, next, paneId, view === "vertical" ? "vertical" : "horizontal");
        setTerminalSplitPaneIds((prev) => ({ ...prev, [tabId]: [next.id] }));
        setTerminalSplitViews((prev) => ({ ...prev, [tabId]: view }));
      } else {
        const paneA = createEmptySplitPane();
        splitPaneInTab(tabId, paneA, paneId, "vertical");

        const paneB = createEmptySplitPane();
        splitPaneInTab(tabId, paneB, paneId, "horizontal");

        const paneC = createEmptySplitPane();
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

  // Handler for creating a new agent tab
  const handleNewAgentTab = useCallback(async (agentId?: string) => {
    const nextIndex = tabs.length + 1;
    const title = `Agent ${nextIndex}`;
    const next = await createAgentPaneNode({
      agentId: agentId ?? "Claude Code",
      meta: {
        title,
      },
    });
    appendPane(next, title);
  }, [appendPane, tabs.length]);

  // Handler for converting an empty pane to a terminal or agent pane
  const handleChooseEmptyPane = useCallback(
    async (paneId: string, paneType: "terminal" | "agent", cwd?: string) => {
      const tabId = activeTabId ?? tabs[0]?.id ?? null;
      if (!tabId) return;

      const tab = tabs.find((item) => item.id === tabId);
      if (!tab) return;

      const existingPane = findPane(tab.layout, paneId);
      if (!existingPane) return;

      // Use the cwd from the callback parameter, or fall back to the existing pane's cwd
      const resolvedCwd = cwd ?? existingPane.meta?.cwd ?? existingPane.meta?.subtitle;

      // Convert the empty pane to the requested type
      const updatedPane = await convertEmptyPane(paneId, paneType, {
        agentId: paneType === "agent" ? "Claude Code" : undefined,
        cwd: resolvedCwd,
      });

      updatePaneInTab(tabId, paneId, updatedPane);
    },
    [activeTabId, tabs, updatePaneInTab]
  );

  // Handler for closing/resetting the active pane
  const handleCloseActivePane = useCallback(async () => {
    const tabId = activeTabId ?? tabs[0]?.id ?? null;
    if (!tabId) return;

    const tab = tabs.find((item) => item.id === tabId);
    if (!tab || !tab.activePaneId) return;

    const pane = findPane(tab.layout, tab.activePaneId);
    if (!pane) return;

    // If in split mode (multiple panes), convert to empty pane
    if (countPanes(tab.layout) > 1) {
      // Clean up terminal session if exists
      if (pane.sessionId) {
        try {
          await killSession({ id: pane.sessionId });
        } catch (error) {
          console.warn("Failed to kill session", error);
        }
        disposeTerminal(pane.sessionId);
      }

      const emptyPane: PaneNode = {
        ...pane,
        isEmpty: true,
        sessionId: "",
      };
      updatePaneInTab(tabId, pane.id, emptyPane);
    } else {
      // Single pane mode - close the tab/pane
      closeActivePane();
    }
  }, [activeTabId, tabs, closeActivePane, updatePaneInTab]);

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
      onCloseActivePane={handleCloseActivePane}
      onNewPane={() => void handleNewPane()}
      onNewAgentTab={(agentId) => void handleNewAgentTab(agentId)}
      onChooseEmptyPane={(paneId, paneType, cwd) => void handleChooseEmptyPane(paneId, paneType, cwd)}
      onSetTerminalView={(tabId, view) => void handleSetTerminalView(tabId, view)}
      repos={repos}
      worktreesByRepo={worktreesByRepo}
    />
  );
}
