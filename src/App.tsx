import { useCallback, useEffect, useMemo, useRef } from "react";
import "./App.css";
import { createPaneNode, killLayoutSessions } from "./services/sessions";
import { useLayoutState } from "./hooks/useLayoutState";
import { useClosePaneHotkey } from "./hooks/useHotkeys";
import { collectPanes } from "./types/layout";
import { TopBar } from "./components/TopBar";
import { StatusBar } from "./components/StatusBar";
import { GitPanel } from "./components/GitPanel";
import { TerminalPanel } from "./components/TerminalPanel";

function App() {
  const {
    layout,
    setLayout,
    activePaneId,
    setActivePaneId,
    appendPane,
    closePane,
    closeActivePane,
  } = useLayoutState();

  useClosePaneHotkey(closeActivePane);

  // Track layout for cleanup
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    let alive = true;
    let initialNode: any = null;

    const start = async () => {
      const next = await createPaneNode({
        meta: {
          title: "Local session",
        },
      });
      initialNode = next;

      if (!alive) {
        void killLayoutSessions(next);
        return;
      }
      setLayout(next);
      setActivePaneId(next.id);
    };

    void start();

    return () => {
      alive = false;
      // If we unmount before setting layout, kill the initial node
      if (initialNode && !layoutRef.current) {
        void killLayoutSessions(initialNode);
      }
    };
  }, [setLayout, setActivePaneId]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      if (layoutRef.current) {
        void killLayoutSessions(layoutRef.current);
      }
    };
  }, []);

  const panes = useMemo(() => collectPanes(layout), [layout]);

  const handleNewPane = useCallback(async () => {
    const nextIndex = panes.length + 1;
    const next = await createPaneNode({
      meta: {
        title: `Terminal ${nextIndex}`,
      },
    });
    appendPane(next);
  }, [appendPane, panes.length]);

  return (
    <main className="app-shell">
      <TopBar />
      <div className="workspace">
        <GitPanel />
        <TerminalPanel
          layout={layout}
          panes={panes}
          activePaneId={activePaneId}
          onSetActivePane={setActivePaneId}
          onClosePane={(id) => void closePane(id)}
          onNewPane={() => void handleNewPane()}
        />
      </div>
      <StatusBar branch="main" errors={0} warnings={3} />
    </main>
  );
}

export default App;
