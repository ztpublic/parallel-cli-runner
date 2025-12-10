import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type Orientation = "vertical" | "horizontal";

type PaneNode = {
  type: "pane";
  id: string;
  sessionId: string;
};

type SplitNode = {
  type: "split";
  id: string;
  orientation: Orientation;
  children: [LayoutNode, LayoutNode];
};

type LayoutNode = PaneNode | SplitNode;

const createId = () => crypto.randomUUID();

function countPanes(node: LayoutNode | null): number {
  if (!node) return 0;
  if (node.type === "pane") return 1;
  return countPanes(node.children[0]) + countPanes(node.children[1]);
}

function findPane(node: LayoutNode | null, paneId: string): PaneNode | null {
  if (!node) return null;
  if (node.type === "pane") return node.id === paneId ? node : null;
  return (
    findPane(node.children[0], paneId) ||
    findPane(node.children[1], paneId)
  );
}

function getFirstPane(node: LayoutNode | null): PaneNode | null {
  if (!node) return null;
  if (node.type === "pane") return node;
  return getFirstPane(node.children[0]) ?? getFirstPane(node.children[1]);
}

function collectPanes(node: LayoutNode | null, acc: PaneNode[] = []): PaneNode[] {
  if (!node) return acc;
  if (node.type === "pane") {
    acc.push(node);
    return acc;
  }
  collectPanes(node.children[0], acc);
  collectPanes(node.children[1], acc);
  return acc;
}

function splitLayout(
  node: LayoutNode,
  targetPaneId: string,
  newPane: PaneNode,
  orientation: Orientation
): LayoutNode {
  if (node.type === "pane" && node.id === targetPaneId) {
    return {
      type: "split",
      id: createId(),
      orientation,
      children: [node, newPane],
    };
  }

  if (node.type === "split") {
    const [left, right] = node.children;
    return {
      ...node,
      children: [
        splitLayout(left, targetPaneId, newPane, orientation),
        splitLayout(right, targetPaneId, newPane, orientation),
      ],
    };
  }

  return node;
}

function removePane(
  node: LayoutNode,
  targetPaneId: string
): LayoutNode | null {
  if (node.type === "pane") {
    return node.id === targetPaneId ? null : node;
  }

  const nextLeft = removePane(node.children[0], targetPaneId);
  const nextRight = removePane(node.children[1], targetPaneId);

  if (!nextLeft && !nextRight) {
    return null;
  }
  if (!nextLeft) {
    return nextRight;
  }
  if (!nextRight) {
    return nextLeft;
  }

  return { ...node, children: [nextLeft, nextRight] };
}

async function createPaneNode(): Promise<PaneNode> {
  const sessionId = await invoke<string>("create_session");
  return {
    type: "pane",
    id: createId(),
    sessionId,
  };
}

type TerminalPaneProps = {
  pane: PaneNode;
  isActive: boolean;
  onFocused: (id: string) => void;
  onInput?: (pane: PaneNode, data: string) => void;
};

function TerminalPane({ pane, isActive, onFocused, onInput }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onInputRef = useRef(onInput);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  const syncSize = useCallback(async () => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    fitAddon.fit();
    const cols = term.cols;
    const rows = term.rows;
    await invoke("resize_session", { id: pane.sessionId, cols, rows });
  }, [pane.sessionId]);

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

    const unsubscribeData = term.onData((data) => {
      void invoke("write_to_session", { id: pane.sessionId, data });
      if (onInputRef.current) {
        onInputRef.current(pane, data);
      }
    });

    let unlisten: (() => void) | undefined;
    listen<SessionData>("session-data", (event) => {
      if (event.payload.id === pane.sessionId) {
        term.write(event.payload.data);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    void syncSize();

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
      unsubscribeData.dispose();
      term.dispose();
      if (unlisten) {
        unlisten();
      }
    };
  }, [pane.sessionId, syncSize]);

  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  return (
    <div
      className={`pane ${isActive ? "pane-active" : ""}`}
      ref={containerRef}
      tabIndex={0}
      onClick={() => onFocused(pane.id)}
    />
  );
}

type LayoutRendererProps = {
  node: LayoutNode;
  activePaneId: string | null;
  onFocusPane: (id: string) => void;
  onPaneInput?: (pane: PaneNode, data: string) => void;
};

function LayoutRenderer({
  node,
  activePaneId,
  onFocusPane,
  onPaneInput,
}: LayoutRendererProps) {
  if (node.type === "pane") {
    return (
      <TerminalPane
        pane={node}
        isActive={node.id === activePaneId}
        onFocused={onFocusPane}
        onInput={onPaneInput}
      />
    );
  }

  const direction =
    node.orientation === "vertical" ? "split-vertical" : "split-horizontal";

  return (
    <div className={`split ${direction}`}>
      {node.children.map((child) => (
        <div
          key={child.id}
          className="split-child"
          style={{ flexGrow: countPanes(child) || 1 }}
        >
          <LayoutRenderer
            node={child}
            activePaneId={activePaneId}
            onFocusPane={onFocusPane}
            onPaneInput={onPaneInput}
          />
        </div>
      ))}
    </div>
  );
}

type SyncBarProps = {
  syncEnabled: boolean;
  onToggleSync: () => void;
  paneCount: number;
  onSplit: () => void;
};

function SyncBar({ syncEnabled, onToggleSync, paneCount, onSplit }: SyncBarProps) {
  return (
    <div className="broadcast-bar">
      <div className="broadcast-meta">
        <button className="chip" onClick={onSplit} title="Split vertically (Ctrl+Shift+D)">
          Split pane
        </button>
        <button
          className={syncEnabled ? "chip active" : "chip"}
          onClick={onToggleSync}
          title="Mirror keystrokes from the active pane to all other panes"
        >
          Sync typing to all panes
        </button>
        <div className="pane-count">Panes: {paneCount}</div>
      </div>
    </div>
  );
}
function App() {
  const [layout, setLayout] = useState<LayoutNode | null>(null);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [syncTyping, setSyncTyping] = useState(false);

  const splitActivePane = useCallback(
    async (orientation: Orientation) => {
      const newPane = await createPaneNode();

      setLayout((prev) => {
        if (!prev) {
          setActivePaneId(newPane.id);
          setSyncTyping(false);
          return newPane;
        }

        const targetPaneId = activePaneId ?? getFirstPane(prev)?.id;
        if (!targetPaneId) {
          setActivePaneId(newPane.id);
          setSyncTyping(false);
          return newPane;
        }

        setActivePaneId(newPane.id);
        return splitLayout(prev, targetPaneId, newPane, orientation);
      });
    },
    [activePaneId]
  );

  const closeActivePane = useCallback(async () => {
    if (!layout || !activePaneId) return;
    if (countPanes(layout) === 1) return;

    const paneToRemove = findPane(layout, activePaneId);
    if (paneToRemove) {
      await invoke("kill_session", { id: paneToRemove.sessionId });
    }

      setLayout((prev) => {
        if (!prev) return prev;
        const next = removePane(prev, activePaneId);
        if (!next) return prev;
        const fallbackPane = getFirstPane(next);
        setActivePaneId(fallbackPane?.id ?? null);
        setSyncTyping(false);
        return next;
      });
    }, [activePaneId, layout]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;
      if (event.code === "KeyD") {
        event.preventDefault();
        void splitActivePane("vertical");
      } else if (event.code === "KeyW") {
        event.preventDefault();
        void closeActivePane();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [splitActivePane, closeActivePane]);

  const paneCount = useMemo(() => countPanes(layout), [layout]);

  return (
    <main className="app-shell">
      <header className="app-header" />
      <SyncBar
        syncEnabled={syncTyping}
        onToggleSync={() => setSyncTyping((prev) => !prev)}
        paneCount={paneCount}
        onSplit={() => void splitActivePane("vertical")}
      />
      <section className="terminal-card">
        {layout ? (
          <div className="layout-root">
            <LayoutRenderer
              node={layout}
              activePaneId={activePaneId}
              onFocusPane={setActivePaneId}
              onPaneInput={
                syncTyping
                  ? (pane, data) => {
                      const targetSessions = collectPanes(layout)
                        .map((p) => p.sessionId)
                        .filter((id) => id !== pane.sessionId);
                      if (!targetSessions.length) return;
                      targetSessions.forEach((id) => {
                        void invoke("write_to_session", { id, data });
                      });
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="loading">
            No terminals yet. Click "Split pane" to start the first one.
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
