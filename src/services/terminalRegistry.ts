import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "xterm";
import type { IDisposable } from "xterm";
import { FitAddon } from "xterm-addon-fit";

type SessionData = {
  id: string;
  data: string;
};

type TerminalEntry = {
  term: Terminal;
  fitAddon: FitAddon;
  onInput: { current?: (data: string) => void };
  dataListener: IDisposable;
  unlisten?: () => void;
  unlistenPromise?: Promise<() => void>;
  disposed: boolean;
};

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
      void invoke("write_to_session", { id: sessionId, data: "\u0004" });
      return false;
    }
    return true;
  });

  const dataListener = term.onData((data) => {
    void invoke("write_to_session", { id: sessionId, data });
    onInputRef.current?.(data);
  });

  const entry: TerminalEntry = {
    term,
    fitAddon,
    onInput: onInputRef,
    dataListener,
    disposed: false,
  };

  entry.unlistenPromise = listen<SessionData>("session-data", (event) => {
    if (event.payload.id === sessionId) {
      term.write(event.payload.data);
    }
  }).then((unlisten) => {
    if (entry.disposed) {
      unlisten();
    } else {
      entry.unlisten = unlisten;
    }
    return unlisten;
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
  } else if (entry.unlistenPromise) {
    void entry.unlistenPromise.then((unlisten) => unlisten());
  }
  entry.term.dispose();
  registry.delete(sessionId);
}
