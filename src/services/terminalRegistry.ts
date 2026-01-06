import { Terminal } from "xterm";
import type { IDisposable } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { subscribeSessionData, writeToSession } from "./backend";
import { TerminalBatchManager } from "./terminalBatchManager";

type TerminalEntry = {
  term: Terminal;
  fitAddon: FitAddon;
  onInput: { current?: (data: string) => void };
  dataListener: IDisposable;
  unlisten?: () => void;
  disposed: boolean;
};

// Batch manager for all terminal sessions
const batchManager = new TerminalBatchManager((sessionId, data, _metrics) => {
  const entry = registry.get(sessionId);
  if (entry && !entry.disposed) {
    entry.term.write(data);
  }
});

export type TerminalHandle = {
  term: Terminal;
  fitAddon: FitAddon;
};

const registry = new Map<string, TerminalEntry>();

function createEntry(sessionId: string, onInput?: (data: string) => void): TerminalEntry {
  const term = new Terminal({
    convertEol: true,
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "IBM Plex Mono, JetBrains Mono, Menlo, monospace",
    disableStdin: false,
    scrollback: 1000, // Limit scrollback buffer to 1000 lines for performance
    theme: {
      background: "#1e1e1e",
    },
  });
  const fitAddon = new FitAddon();
  const onInputRef = { current: onInput };

  term.loadAddon(fitAddon);
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== "keydown") {
      return true;
    }
    if (event.ctrlKey && !event.altKey && !event.metaKey && event.code === "KeyD") {
      void writeToSession({ id: sessionId, data: "\u0004" });
      return false;
    }
    return true;
  });

  const dataListener = term.onData((data) => {
    void writeToSession({ id: sessionId, data });
    onInputRef.current?.(data);
    // Flush pending batches immediately on user input for responsiveness
    batchManager.flush(sessionId);
  });

  const entry: TerminalEntry = {
    term,
    fitAddon,
    onInput: onInputRef,
    dataListener,
    disposed: false,
  };

  entry.unlisten = subscribeSessionData((payload) => {
    if (payload.id === sessionId) {
      // Use batch manager instead of direct write
      batchManager.queueWrite(sessionId, payload.data);
    }
  });

  return entry;
}

export function attachTerminal(
  sessionId: string,
  container: HTMLElement,
  onInput?: (data: string) => void
): TerminalHandle {
  const entry = registry.get(sessionId) ?? createEntry(sessionId, onInput);
  entry.onInput.current = onInput;
  registry.set(sessionId, entry);

  if (entry.term.element) {
    if (entry.term.element.parentElement !== container) {
      container.appendChild(entry.term.element);
    }
  } else {
    entry.term.open(container);
  }

  return { term: entry.term, fitAddon: entry.fitAddon };
}

export function detachTerminal(sessionId: string, container: HTMLElement | null): void {
  const entry = registry.get(sessionId);
  if (!entry || !container) return;
  const element = entry.term.element;
  if (element && element.parentElement === container) {
    container.removeChild(element);
  }
}

export function disposeTerminal(sessionId: string): void {
  const entry = registry.get(sessionId);
  if (!entry) return;
  entry.disposed = true;
  entry.dataListener.dispose();
  if (entry.unlisten) {
    entry.unlisten();
  }
  entry.term.dispose();
  // Clean up batch manager for this session
  batchManager.dispose(sessionId);
  registry.delete(sessionId);
}

/**
 * Flush pending batch for a session (call when terminal receives focus).
 */
export function flushTerminalBatch(sessionId: string): void {
  batchManager.flush(sessionId);
}

/**
 * Get buffer info for a terminal session.
 */
export function getTerminalBufferInfo(sessionId: string): { size: number; chunkCount: number } | null {
  const entry = registry.get(sessionId);
  if (!entry) return null;
  return {
    size: entry.term.buffer.active.length,
    chunkCount: 0,
  };
}

/**
 * Clear the terminal buffer for a session.
 */
export function clearTerminalBuffer(sessionId: string): void {
  const entry = registry.get(sessionId);
  if (!entry) return;
  entry.term.clear();
}
