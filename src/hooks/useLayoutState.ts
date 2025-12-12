import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutNode, PaneNode } from "../types/layout";
import {
  collectPanes,
  buildLayoutFromPanes,
  countPanes,
  findPane,
  getFirstPane,
  removePane,
} from "../types/layout";
import { killSession, writeToSession } from "../services/tauri";

export function useLayoutState() {
  const [layout, setLayout] = useState<LayoutNode | null>(null);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const layoutRef = useRef<LayoutNode | null>(layout);
  const activePaneIdRef = useRef<string | null>(activePaneId);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    activePaneIdRef.current = activePaneId;
  }, [activePaneId]);

  const resetLayoutState = useCallback(() => {
    setLayout(null);
    setActivePaneId(null);
  }, []);

  const getLayoutSnapshot = useCallback(() => layoutRef.current, []);

  const appendPane = useCallback((pane: PaneNode) => {
    setLayout((prev) => {
      const panes = collectPanes(prev);
      return buildLayoutFromPanes([...panes, pane]);
    });
    setActivePaneId(pane.id);
  }, []);

  const closeActivePane = useCallback(async () => {
    const currentLayout = layoutRef.current;
    const currentActivePaneId = activePaneIdRef.current;
    if (!currentLayout || !currentActivePaneId) return;
    if (countPanes(currentLayout) === 1) return;

    const paneToRemove = findPane(currentLayout, currentActivePaneId);
    if (paneToRemove) {
      await killSession({ id: paneToRemove.sessionId });
    }

    setLayout((prev) => {
      if (!prev) return prev;
      const next = removePane(prev, currentActivePaneId);
      if (!next) return prev;
      const fallbackPane = getFirstPane(next);
      setActivePaneId(fallbackPane?.id ?? null);
      return next;
    });
  }, []);

  const broadcastPaneInput = useCallback((pane: PaneNode, data: string) => {
    const currentLayout = layoutRef.current;
    if (!currentLayout) return;
    const targetSessions = collectPanes(currentLayout)
      .map((p) => p.sessionId)
      .filter((id) => id !== pane.sessionId);
    if (!targetSessions.length) return;
    targetSessions.forEach((id) => {
      void writeToSession({ id, data });
    });
  }, []);

  return {
    layout,
    setLayout,
    activePaneId,
    setActivePaneId,
    resetLayoutState,
    getLayoutSnapshot,
    appendPane,
    closeActivePane,
    broadcastPaneInput,
  };
}
