import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutNode, Orientation, PaneNode } from "../types/layout";
import {
  collectPanes,
  countPanes,
  findPane,
  getFirstPane,
  getLayoutOrientation,
  appendPaneToLayout,
  removePane,
  splitPane,
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
      const orientation = getLayoutOrientation(prev);
      return appendPaneToLayout(prev, pane, orientation);
    });
    setActivePaneId(pane.id);
  }, []);

  const splitPaneInLayout = useCallback(
    (pane: PaneNode, targetPaneId: string, orientation: Orientation) => {
      setLayout((prev) => {
        if (!prev) return prev;
        const next = splitPane(prev, targetPaneId, pane, orientation);
        if (next === prev) {
          const fallbackOrientation = getLayoutOrientation(prev);
          return appendPaneToLayout(prev, pane, fallbackOrientation);
        }
        return next;
      });
      setActivePaneId(pane.id);
    },
    []
  );

  const closePane = useCallback(async (paneId: string) => {
    const currentLayout = layoutRef.current;
    if (!currentLayout) return;
    if (countPanes(currentLayout) === 1) return;

    const paneToRemove = findPane(currentLayout, paneId);
    if (paneToRemove) {
      await killSession({ id: paneToRemove.sessionId });
    }

    setLayout((prev) => {
      if (!prev) return prev;
      const next = removePane(prev, paneId);
      if (!next) return prev;
      if (activePaneIdRef.current === paneId) {
        const fallbackPane = getFirstPane(next);
        setActivePaneId(fallbackPane?.id ?? null);
      }
      return next;
    });
  }, []);

  const closeActivePane = useCallback(async () => {
    const currentActivePaneId = activePaneIdRef.current;
    if (!currentActivePaneId) return;
    await closePane(currentActivePaneId);
  }, [closePane]);

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
    splitPaneInLayout,
    closePane,
    closeActivePane,
    broadcastPaneInput,
  };
}
