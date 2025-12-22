import { useEffect, useState } from "react";
import "./App.css";
import { createPaneNode } from "./services/sessions";
import { killSession } from "./services/tauri";
import { PaneNode } from "./types/layout";
import { TerminalPane } from "./components/TerminalPane";
function App() {
  const [pane, setPane] = useState<PaneNode | null>(null);

  useEffect(() => {
    let alive = true;
    let sessionId: string | null = null;

    const start = async () => {
      const next = await createPaneNode({
        meta: {
          title: "Local session",
        },
      });
      sessionId = next.sessionId;
      if (!alive) {
        void killSession({ id: next.sessionId });
        return;
      }
      setPane(next);
    };

    void start();

    return () => {
      alive = false;
      if (sessionId) {
        void killSession({ id: sessionId });
      }
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="terminal-shell">
        {pane ? (
          <TerminalPane
            pane={pane}
            isActive
            onFocused={() => undefined}
          />
        ) : (
          <div className="loading">Booting terminal session…</div>
        )}
      </section>
    </main>
  );
}

export default App;
