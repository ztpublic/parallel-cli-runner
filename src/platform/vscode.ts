type VscodeRequest = {
  type: "vscode-request";
  id: string;
  method: string;
  params?: unknown;
};

type VscodeResponse = {
  type: "vscode-response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: {
    message: string;
    code?: string;
    data?: unknown;
  };
};

type VscodeEvent = {
  type: "vscode-event";
  event: string;
  payload: unknown;
};

type VscodeMessage = VscodeRequest | VscodeResponse | VscodeEvent;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type VscodeApi = {
  postMessage: (message: unknown) => void;
};

declare global {
  interface Window {
    acquireVsCodeApi?: () => VscodeApi;
  }
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

class VscodeBridge {
  private readonly api: VscodeApi;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();

  constructor(api: VscodeApi) {
    this.api = api;
    window.addEventListener("message", this.handleMessage);
  }

  request<T>(method: string, params?: unknown): Promise<T> {
    const id = createRequestId();
    const message: VscodeRequest = { type: "vscode-request", id, method, params };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.api.postMessage(message);
      } catch (error) {
        this.pending.delete(id);
        reject(
          error instanceof Error
            ? error
            : new Error("Failed to send VS Code message")
        );
      }
    });
  }

  subscribe<T>(event: string, handler: (payload: T) => void): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as (payload: unknown) => void);
    this.handlers.set(event, set);
    return () => {
      const handlers = this.handlers.get(event);
      if (!handlers) return;
      handlers.delete(handler as (payload: unknown) => void);
      if (!handlers.size) {
        this.handlers.delete(event);
      }
    };
  }

  private handleMessage = (event: MessageEvent): void => {
    const message = event.data as VscodeMessage | undefined;
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "vscode-response") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.ok) {
        pending.resolve(message.result as unknown);
      } else {
        const error = new Error(message.error?.message || "Request failed");
        if (message.error?.code) {
          (error as { code?: string }).code = message.error.code;
        }
        pending.reject(error);
      }
      return;
    }

    if (message.type === "vscode-event") {
      const handlers = this.handlers.get(message.event);
      if (!handlers) return;
      handlers.forEach((handler) => handler(message.payload));
    }
  };
}

let bridgeInstance: VscodeBridge | null | undefined = undefined;

export function getVscodeBridge(): VscodeBridge | null {
  if (bridgeInstance !== undefined) {
    return bridgeInstance;
  }

  const api = window.acquireVsCodeApi?.();
  if (!api) {
    bridgeInstance = null;
    return null;
  }

  bridgeInstance = new VscodeBridge(api);
  return bridgeInstance;
}
