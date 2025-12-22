import { useCallback, useEffect, useMemo, useRef } from "react";
import "./App.css";
import { createPaneNode, killLayoutSessions } from "./services/sessions";
import { useLayoutState } from "./hooks/useLayoutState";
import { useClosePaneHotkey } from "./hooks/useHotkeys";
import { LayoutRenderer } from "./components/LayoutRenderer";
import { collectPanes } from "./types/layout";
import { TopBar } from "./components/TopBar";
import { StatusBar } from "./components/StatusBar";
import { GitPanel } from "./components/GitPanel";
import { Icon } from "./components/Icons";

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
        <section className="terminal-panel">
          <div className="terminal-header">
            <div className="terminal-tabs" role="tablist" aria-label="Terminal sessions">
              {panes.map((pane, index) => {
                const isActive = pane.id === activePaneId;
                return (
                  <div
                    key={pane.id}
                    className={`terminal-tab ${isActive ? "is-active" : ""}`}
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    onClick={() => setActivePaneId(pane.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActivePaneId(pane.id);
                      }
                    }}
                  >
                    <Icon name="terminal" size={14} />
                    <span>{pane.meta?.title ?? `Terminal ${index + 1}`}</span>
                    {panes.length > 1 ? (
                      <button
                        type="button"
                        className="terminal-tab-close"
                        onClick={(event) => {
                          event.stopPropagation();
                          void closePane(pane.id);
                        }}
                        title="Close terminal"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="terminal-actions">
              <button type="button" className="icon-button" title="New terminal" onClick={handleNewPane}>
                <Icon name="plus" size={16} />
              </button>
              <button type="button" className="icon-button" title="Split terminal" onClick={handleNewPane}>
                <Icon name="split" size={16} />
              </button>
              <button type="button" className="icon-button" title="Terminal settings">
                <Icon name="settings" size={16} />
              </button>
            </div>
          </div>
          <section className="terminal-shell">
            {layout ? (
              <LayoutRenderer
                node={layout}
                activePaneId={activePaneId}
                onFocus={setActivePaneId}
              />
            ) : (
              <div className="loading">Booting terminal session…</div>
            )}
          </section>
        </section>
      </div>
      <StatusBar branch="main" errors={0} warnings={3} />
    </main>
  );
}

export default App;
