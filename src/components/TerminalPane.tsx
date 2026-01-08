import { useCallback, useEffect, useRef } from "react";
import "xterm/css/xterm.css";
import { PaneNode } from "../types/layout";
import { attachTerminal, detachTerminal, flushTerminalBatch, type TerminalHandle } from "../services/terminalRegistry";
import { resizeSession } from "../services/backend";
import { createDebounce } from "../utils/debounce";

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
  const debouncedSyncSizeRef = useRef<ReturnType<typeof createDebounce<typeof syncSize>> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

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
    await resizeSession({ id: pane.sessionId, cols, rows });
  }, [pane.sessionId]);

  const scheduleSyncSize = useCallback(() => {
    debouncedSyncSizeRef.current?.();
  }, []);

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

    // Create enhanced debounced resize function with RAF alignment
    const debouncedSyncSize = createDebounce(syncSize, 100, {
      trailing: true,
      useRaf: true,
    });
    debouncedSyncSizeRef.current = debouncedSyncSize;

    const resizeObserver = new ResizeObserver(() => {
      debouncedSyncSize();
    });
    resizeObserverRef.current = resizeObserver;
    resizeObserver.observe(container);
    window.addEventListener("resize", debouncedSyncSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", debouncedSyncSize);
      debouncedSyncSize.cancel();
      detachTerminal(pane.sessionId, container);
    };
  }, [pane, pane.sessionId, syncSize]);

  useEffect(() => {
    const term = terminalRef.current?.term;
    if (isActive && term) {
      term.focus();
      // Flush pending batch immediately when terminal becomes active
      flushTerminalBatch(pane.sessionId);
    }
  }, [isActive, pane.sessionId]);

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
