import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./App.css";

type SessionData = {
  id: string;
  data: string;
};

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const syncSize = useCallback(async () => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    const sessionId = sessionIdRef.current;
    if (!term || !fitAddon || !sessionId) return;

    fitAddon.fit();
    const cols = term.cols;
    const rows = term.rows;
    await invoke("resize_session", { id: sessionId, cols, rows });
  }, []);

  useEffect(() => {
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 14,
      disableStdin: false,
      theme: {
        background: "#0b1021",
      },
    });
    const fitAddon = new FitAddon();
    termRef.current = term;
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    if (containerRef.current) {
      term.open(containerRef.current);
    }

    const unsubscribe = term.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void invoke("write_to_session", { id: sessionId, data });
      }
    });

    let unlisten: (() => void) | undefined;
    listen<SessionData>("session-data", (event) => {
      const sessionId = sessionIdRef.current;
      if (sessionId && event.payload.id === sessionId) {
        term.write(event.payload.data);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    const init = async () => {
      const id = await invoke<string>("create_session");
      sessionIdRef.current = id;
      term.focus();
      await syncSize();
    };

    init();

    const resizeObserver = new ResizeObserver(() => {
      void syncSize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", syncSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncSize);
      unsubscribe.dispose();
      term.dispose();
      if (unlisten) {
        unlisten();
      }
    };
  }, [syncSize]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Phase 2: Single PTY</p>
          <h1>Local shell over PTY</h1>
          <p className="lede">
            React + xterm.js wired to a Rust portable-pty backend.
          </p>
        </div>
      </header>
      <section className="terminal-card">
        <div className="terminal-frame" ref={containerRef} />
      </section>
    </main>
  );
}

export default App;
