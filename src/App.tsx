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

type BroadcastTarget = "none" | "all" | { paneIds: string[] };

type BroadcastState = {
  enabled: boolean;
  targets: BroadcastTarget;
};

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
};

function TerminalPane({ pane, isActive, onFocused }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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
};

function LayoutRenderer({
  node,
  activePaneId,
  onFocusPane,
}: LayoutRendererProps) {
  if (node.type === "pane") {
    return (
      <TerminalPane
        pane={node}
        isActive={node.id === activePaneId}
        onFocused={onFocusPane}
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
          />
        </div>
      ))}
    </div>
  );
}

type BroadcastBarProps = {
  broadcast: BroadcastState;
  setBroadcast: React.Dispatch<React.SetStateAction<BroadcastState>>;
  layout: LayoutNode | null;
};

function resolveTargetToSessionIds(
  target: BroadcastTarget,
  layout: LayoutNode | null
): string[] {
  const panes = collectPanes(layout);
  if (target === "none") return [];
  if (target === "all") return panes.map((p) => p.sessionId);
  const idSet = new Set(target.paneIds);
  return panes.filter((p) => idSet.has(p.id)).map((p) => p.sessionId);
}

function BroadcastBar({ broadcast, setBroadcast, layout }: BroadcastBarProps) {
  const [text, setText] = useState("");
  const panes = useMemo(() => collectPanes(layout), [layout]);

  useEffect(() => {
    if (broadcast.targets === "none" || broadcast.targets === "all") return;
    const allowedIds = new Set(panes.map((p) => p.id));
    const filtered = broadcast.targets.paneIds.filter((id) =>
      allowedIds.has(id)
    );
    if (filtered.length !== broadcast.targets.paneIds.length) {
      setBroadcast((prev) => ({ ...prev, targets: { paneIds: filtered } }));
    }
  }, [broadcast, panes, setBroadcast]);

  const send = useCallback(() => {
    if (!broadcast.enabled || !text.trim()) return;
    const sessionIds = resolveTargetToSessionIds(broadcast.targets, layout);
    if (!sessionIds.length) return;
    // Send carriage return only to mirror the Enter key that xterm emits in raw mode.
    void invoke("broadcast_line", { sessionIds, line: `${text}\r\n` });
    setText("");
  }, [broadcast, layout, text]);

  const togglePane = (paneId: string) => {
    setBroadcast((prev) => {
      const currentList =
        prev.targets === "none"
          ? []
          : prev.targets === "all"
            ? panes.map((p) => p.id)
            : [...prev.targets.paneIds];
      const nextList = currentList.includes(paneId)
        ? currentList.filter((id) => id !== paneId)
        : [...currentList, paneId];
      return { ...prev, targets: { paneIds: nextList } };
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  const selectedCount =
    broadcast.targets === "all"
      ? panes.length
      : broadcast.targets === "none"
        ? 0
        : broadcast.targets.paneIds.length;

  return (
    <div className="broadcast-bar">
      <div className="broadcast-meta">
        <label className="switch">
          <input
            type="checkbox"
            checked={broadcast.enabled}
            onChange={(e) =>
              setBroadcast({ ...broadcast, enabled: e.target.checked })
            }
          />
          <span>Broadcast</span>
        </label>
        <div className="broadcast-targets">
          <button
            className={broadcast.targets === "all" ? "chip active" : "chip"}
            onClick={() => setBroadcast({ ...broadcast, targets: "all" })}
          >
            All panes
          </button>
          <button
            className={
              broadcast.targets !== "all" && broadcast.targets !== "none"
                ? "chip active"
                : "chip"
            }
            onClick={() =>
              setBroadcast({
                ...broadcast,
                targets:
                  broadcast.targets === "none"
                    ? { paneIds: panes.map((p) => p.id) }
                    : broadcast.targets,
              })
            }
          >
            Selected ({selectedCount})
          </button>
          <button
            className={broadcast.targets === "none" ? "chip active" : "chip"}
            onClick={() => setBroadcast({ ...broadcast, targets: "none" })}
          >
            None
          </button>
        </div>
      </div>
      {broadcast.targets !== "all" && (
        <div className="pane-selector">
          {panes.map((pane) => (
            <label key={pane.id} className="pane-check">
              <input
                type="checkbox"
                checked={
                  broadcast.targets !== "none" &&
                  broadcast.targets !== "all" &&
                  broadcast.targets.paneIds.includes(pane.id)
                }
                onChange={() => togglePane(pane.id)}
              />
              <span>{pane.id.slice(0, 6)}</span>
            </label>
          ))}
        </div>
      )}
      <div className="broadcast-input-row">
        <input
          type="text"
          placeholder="Broadcast command (Alt+Enter to send)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button onClick={send} disabled={!broadcast.enabled}>
          Send
        </button>
      </div>
    </div>
  );
}
function App() {
  const [layout, setLayout] = useState<LayoutNode | null>(null);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState<BroadcastState>(() => ({
    enabled: true,
    targets: "all",
  }));

  useEffect(() => {
    const init = async () => {
      const pane = await createPaneNode();
      setLayout(pane);
      setActivePaneId(pane.id);
      setBroadcast((prev) => ({
        ...prev,
        targets: { paneIds: [pane.id] },
      }));
    };
    void init();
  }, []);

  const splitActivePane = useCallback(
    async (orientation: Orientation) => {
      if (!layout || !activePaneId) return;
      const newPane = await createPaneNode();

      setLayout((prev) => {
        if (!prev) return prev;
        return splitLayout(prev, activePaneId, newPane, orientation);
      });
      setActivePaneId(newPane.id);
    },
    [activePaneId, layout]
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
        setBroadcast((prevBroadcast) => {
          if (
            prevBroadcast.targets === "none" ||
            prevBroadcast.targets === "all"
          ) {
            return prevBroadcast;
          }
          const remaining = prevBroadcast.targets.paneIds.filter(
            (id) => id !== activePaneId
          );
          return { ...prevBroadcast, targets: { paneIds: remaining } };
        });
        return next;
      });
    }, [activePaneId, layout]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;
      if (event.code === "KeyD") {
        event.preventDefault();
        void splitActivePane("vertical");
      } else if (event.code === "KeyE") {
        event.preventDefault();
        void splitActivePane("horizontal");
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
      <header className="app-header">
        <div>
          <p className="eyebrow">Phase 3: Multi-pane PTY</p>
          <h1>Split terminals, one PTY per pane</h1>
          <p className="lede">
            Ctrl+Shift+D to split vertically, Ctrl+Shift+E horizontally,
            Ctrl+Shift+W to close a pane.
          </p>
        </div>
        <div className="pane-count">Panes: {paneCount}</div>
      </header>
      <BroadcastBar
        broadcast={broadcast}
        setBroadcast={setBroadcast}
        layout={layout}
      />
      <section className="terminal-card">
        {layout ? (
          <div className="layout-root">
            <LayoutRenderer
              node={layout}
              activePaneId={activePaneId}
              onFocusPane={setActivePaneId}
            />
          </div>
        ) : (
          <div className="loading">Booting PTY...</div>
        )}
      </section>
    </main>
  );
}

export default App;
