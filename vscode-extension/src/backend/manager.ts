import * as crypto from "crypto";
import * as net from "net";
import * as vscode from "vscode";
import type { BackendState, ExtensionSettings } from "../types";
import { resolveBackendPath } from "./finder";
import { getExternalBackend } from "./external";

// Task source and type for the backend server
const BACKEND_TASK_SOURCE = "parallel-cli-runner";
const BACKEND_TASK_TYPE = "backend";

/**
 * Ensure the backend is running and return its state
 * Creates a new backend if needed, or returns the existing one
 */
export async function ensureBackend(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel
): Promise<BackendState> {
  // Check for cached backend state
  let backendState = getBackendState();
  if (backendState) {
    return backendState;
  }

  const settings = loadSettings();

  // Check for external backend configuration
  const externalBackend = getExternalBackend();
  if (externalBackend) {
    output.appendLine(`Using external backend: ${externalBackend.wsUrl}`);
    const ready = await waitForBackendReady(
      externalBackend.wsUrl,
      externalBackend.authToken,
      output
    );
    if (!ready) {
      throw new Error("External backend did not respond to WebSocket handshake.");
    }
    backendState = { ...externalBackend, taskExecution: null, settings };
    setBackendState(backendState);
    return backendState;
  }

  // Spawn a new backend process using Task API
  const port = await findAvailablePort();
  const authToken = crypto.randomBytes(16).toString("hex");
  const wsUrl = `ws://127.0.0.1:${port}`;

  const backendPath = resolveBackendPath(context, settings);
  if (!backendPath) {
    vscode.window.showErrorMessage(
      "Backend binary not found. Run `cargo build --manifest-path src-tauri/Cargo.toml` or set parallelCliRunner.backendPath."
    );
    backendState = { wsUrl, authToken, port, taskExecution: null, settings };
    setBackendState(backendState);
    return backendState;
  }

  const args = ["--port", String(port), "--auth-token", authToken, ...settings.backendArgs];
  output.appendLine(`Starting backend: ${backendPath} ${args.join(" ")}`);

  // Create a task definition for the backend server
  const taskDefinition: vscode.TaskDefinition = {
    type: BACKEND_TASK_TYPE,
    command: backendPath,
    args: args,
  };

  // Create the task with shell execution for proper environment variable handling
  // Filter out undefined values from process.env
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...process.env, ...settings.backendEnv })) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  const task = new vscode.Task(
    taskDefinition,
    vscode.TaskScope.Global,
    "Backend Server",
    BACKEND_TASK_SOURCE,
    new vscode.ShellExecution(backendPath, args, {
      env,
    })
  );

  // Set the presentation options to run without showing the terminal
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Silent,
    echo: true,
    focus: false,
    panel: vscode.TaskPanelKind.Shared,
    showReuseMessage: false,
    clear: true,
  };

  // Execute the task
  const execution = await vscode.tasks.executeTask(task);

  // Wait for the task to start
  await new Promise((resolve) => setTimeout(resolve, 500));

  const ready = await waitForBackendReady(wsUrl, authToken, output);
  if (!ready) {
    execution.terminate();
    throw new Error("Backend did not respond to WebSocket handshake.");
  }

  // Set up task exit handler
  const disposable = vscode.tasks.onDidEndTask((e: vscode.TaskEndEvent) => {
    if (e.execution === execution) {
      output.appendLine("Backend task ended.");
      setBackendState(null);
      disposable.dispose();
    }
  });

  backendState = { wsUrl, authToken, port, taskExecution: execution, settings };
  setBackendState(backendState);
  return backendState;
}

/**
 * Kill the backend process if it's running
 */
export function killBackend(): void {
  const backendState = getBackendState();
  if (backendState?.taskExecution) {
    backendState.taskExecution.terminate();
  }
  setBackendState(null);
}

// Module state management
let cachedBackendState: BackendState | null = null;

function getBackendState(): BackendState | null {
  return cachedBackendState;
}

function setBackendState(state: BackendState | null): void {
  cachedBackendState = state;
}

function loadSettings(): ExtensionSettings {
  // Lazy import to avoid circular dependency
  const { loadMergedSettings } = require("../config/merger");
  return loadMergedSettings();
}

/**
 * Find an available port on localhost
 */
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to resolve port"));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

/**
 * Wait for the backend to be ready by checking WebSocket handshake
 * Retries with exponential backoff
 */
async function waitForBackendReady(
  wsUrl: string,
  authToken: string,
  output: vscode.OutputChannel,
  attempts = 20,
  delayMs = 250
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const ok = await checkWebSocketHandshake(wsUrl, authToken);
    if (ok) {
      return true;
    }
    output.appendLine(`Backend not ready (attempt ${attempt + 1}/${attempts})`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

/**
 * Check if the backend is ready by performing a WebSocket handshake
 */
function checkWebSocketHandshake(wsUrl: string, authToken: string): Promise<boolean> {
  return new Promise((resolve) => {
    let socket: net.Socket | null = null;
    try {
      const url = new URL(wsUrl);
      url.searchParams.set("token", authToken);
      const port = Number(url.port || "0");
      if (!Number.isFinite(port) || port <= 0) {
        resolve(false);
        return;
      }

      const key = crypto.randomBytes(16).toString("base64");
      const pathWithQuery = `${url.pathname}${url.search}`;
      const request = [
        `GET ${pathWithQuery} HTTP/1.1`,
        `Host: ${url.hostname}:${port}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        "Sec-WebSocket-Version: 13",
        `Sec-WebSocket-Key: ${key}`,
        "\r\n",
      ].join("\r\n");

      socket = net.connect(port, url.hostname);
      socket.setTimeout(1000);
      socket.on("connect", () => {
        socket?.write(request);
      });
      socket.on("data", (data) => {
        const response = data.toString();
        resolve(response.includes(" 101 ") || response.startsWith("HTTP/1.1 101"));
        socket?.destroy();
      });
      socket.on("timeout", () => {
        resolve(false);
        socket?.destroy();
      });
      socket.on("error", () => {
        resolve(false);
      });
      socket.on("close", () => {
        socket = null;
      });
    } catch {
      resolve(false);
      if (socket) {
        socket.destroy();
      }
    }
  });
}

// Re-export finder functions for convenience
export { resolveBackendPath } from "./finder";
// Re-export external functions for convenience
export { getExternalBackend, parseWsUrl, buildConnectSrc } from "./external";
