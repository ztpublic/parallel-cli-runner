import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "xterm/css/xterm.css";
import { PaneNode } from "../types/layout";
import { attachTerminal, detachTerminal, type TerminalHandle } from "../services/terminalRegistry";

type TerminalPaneProps = {
  pane: PaneNode;
  isActive: boolean;
  onFocused: (id: string) => void;
  onInput?: (pane: PaneNode, data: string) => void;
  layoutTick?: number;
};

export function TerminalPane({
  pane,
  isActive,
  onFocused,
  onInput,
  layoutTick,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<TerminalHandle | null>(null);
  const onInputRef = useRef(onInput);
  const resizeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  const syncSize = useCallback(async () => {
    const handle = terminalRef.current;
    const term = handle?.term ?? null;
    const fitAddon = handle?.fitAddon ?? null;
    if (!term || !fitAddon) return;

    fitAddon.fit();
    const cols = term.cols;
    const rows = term.rows;
    await invoke("resize_session", { id: pane.sessionId, cols, rows });
    term.refresh(0, Math.max(0, term.rows - 1));
  }, [pane.sessionId]);

  const scheduleSyncSize = useCallback(() => {
    if (resizeTimeoutRef.current !== null) return;
    resizeTimeoutRef.current = window.setTimeout(() => {
      resizeTimeoutRef.current = null;
      void syncSize();
    }, 100);
  }, [syncSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handle = attachTerminal(pane.sessionId, container, (data) => {
      if (onInputRef.current) {
        onInputRef.current(pane, data);
      }
    });
    terminalRef.current = handle;
    void syncSize();

    const resizeObserver = new ResizeObserver(() => {
      scheduleSyncSize();
    });
    resizeObserver.observe(container);
    window.addEventListener("resize", scheduleSyncSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleSyncSize);
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      detachTerminal(pane.sessionId, container);
    };
  }, [pane, pane.sessionId, scheduleSyncSize, syncSize]);

  useEffect(() => {
    const term = terminalRef.current?.term;
    if (isActive && term) {
      term.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (layoutTick === undefined) return;
    scheduleSyncSize();
  }, [layoutTick, scheduleSyncSize]);

  return (
    <div
      className={`pane ${isActive ? "pane-active" : ""}`}
      ref={containerRef}
      tabIndex={0}
      onClick={() => onFocused(pane.id)}
    >
      <div className="pane-label" aria-hidden>
        <div className="pane-label-primary">{pane.meta?.title ?? "Terminal"}</div>
        {pane.meta?.subtitle ? (
          <div className="pane-label-sub">{pane.meta.subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
