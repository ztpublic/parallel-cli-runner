import { getAppConfig } from "./config";

type TransportRequest = {
  type: "request";
  id: string;
  method: string;
  params?: unknown;
};

type TransportResponse = {
  type: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: {
    message: string;
    code?: string;
    data?: unknown;
  };
};

type TransportEvent = {
  type: "event";
  event: string;
  payload: unknown;
};

type TransportMessage = TransportRequest | TransportResponse | TransportEvent;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export interface Transport {
  request<T>(method: string, params?: unknown): Promise<T>;
  subscribe<T>(event: string, handler: (payload: T) => void): () => void;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function buildWsUrl(baseUrl: string, authToken?: string): string {
  if (!authToken) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set("token", authToken);
  return url.toString();
}

class WsTransport implements Transport {
  private readonly url: string;
  private ws: WebSocket | null = null;
  private connectionPromise: Promise<void> | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();

  constructor(baseUrl: string, authToken?: string) {
    this.url = buildWsUrl(baseUrl, authToken);
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    await this.ensureConnected();
    const id = createRequestId();
    const message: TransportRequest = { type: "request", id, method, params };
    const payload = JSON.stringify(message);

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      try {
        this.ws?.send(payload);
      } catch (error) {
        this.pending.delete(id);
        reject(
          error instanceof Error
            ? error
            : new Error("Failed to send WebSocket message")
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

  private async ensureConnected(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      const handleOpen = () => {
        this.connectionPromise = null;
        resolve();
      };

      const handleError = () => {
        this.connectionPromise = null;
        reject(new Error("WebSocket connection failed"));
      };

      ws.addEventListener("open", handleOpen);
      ws.addEventListener("error", handleError);
      ws.addEventListener("message", (event) => this.handleMessage(event));
      ws.addEventListener("close", () => this.handleClose());
    });

    return this.connectionPromise;
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") {
      return;
    }

    let message: TransportMessage | null = null;
    try {
      message = JSON.parse(event.data) as TransportMessage;
    } catch {
      return;
    }

    if (!message) return;

    if (message.type === "response") {
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

    if (message.type === "event") {
      const handlers = this.handlers.get(message.event);
      if (!handlers) return;
      handlers.forEach((handler) => handler(message.payload));
    }
  }

  private handleClose(): void {
    const error = new Error("WebSocket disconnected");
    this.pending.forEach((pending) => pending.reject(error));
    this.pending.clear();
    this.ws = null;
  }
}

class TauriTransport implements Transport {
  async request<T>(method: string, params?: unknown): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(method, params as Record<string, unknown> | undefined);
  }

  subscribe<T>(event: string, handler: (payload: T) => void): () => void {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<T>(event, (evt) => handler(evt.payload)).then((stop) => {
          if (disposed) {
            stop();
          } else {
            unlisten = stop;
          }
        })
      )
      .catch(() => {
        // Ignore; missing Tauri runtime will be handled by the caller.
      });

    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }
}

let transportInstance: Transport | null = null;

export function getTransport(): Transport {
  if (!transportInstance) {
    const config = getAppConfig();
    if (config.wsUrl) {
      transportInstance = new WsTransport(config.wsUrl, config.authToken);
    } else {
      transportInstance = new TauriTransport();
    }
  }
  return transportInstance;
}
