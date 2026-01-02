import * as crypto from "crypto";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import * as vscode from "vscode";

const CONFIG_FILE = ".vscode/parallel-cli-runner.json";

type ExtensionSettings = {
  backendPath: string;
  backendArgs: string[];
  backendEnv: Record<string, string>;
};

type BackendState = {
  wsUrl: string;
  authToken: string;
  port: number;
  process: ChildProcessWithoutNullStreams | null;
  settings: ExtensionSettings;
};

type WebviewRequest = {
  type: "vscode-request";
  id: string;
  method: string;
  params?: unknown;
};

type WebviewResponse = {
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

const ENV_WS_URL = "PARALLEL_CLI_RUNNER_WS_URL";
const ENV_AUTH_TOKEN = "PARALLEL_CLI_RUNNER_AUTH_TOKEN";

let backendState: BackendState | null = null;
let panel: vscode.WebviewPanel | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Parallel CLI Runner");
  context.subscriptions.push(output);
  void ensureBackend(context, output).catch((error) => {
    output.appendLine(`Backend init failed: ${(error as Error).message}`);
  });

  const openCommand = vscode.commands.registerCommand("parallelCliRunner.open", async () => {
    if (panel) {
      panel.reveal();
      return;
    }

    let backend: BackendState;
    try {
      backend = await ensureBackend(context, output);
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Failed to start backend: ${(error as Error).message}`
      );
      return;
    }
    panel = vscode.window.createWebviewPanel(
      "parallelCliRunner",
      "Parallel CLI Runner",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "webview")],
      }
    );

    panel.webview.html = buildWebviewHtml(panel.webview, context.extensionUri, backend);

    const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
      const request = message as WebviewRequest | undefined;
      if (!request || request.type !== "vscode-request" || !request.id) {
        return;
      }

      try {
        const result = await handleWebviewRequest(request);
        const response: WebviewResponse = {
          type: "vscode-response",
          id: request.id,
          ok: true,
          result,
        };
        void panel?.webview.postMessage(response);
      } catch (error) {
        const response: WebviewResponse = {
          type: "vscode-response",
          id: request.id,
          ok: false,
          error: { message: (error as Error).message || "Request failed" },
        };
        void panel?.webview.postMessage(response);
      }
    });

    panel.onDidDispose(() => {
      messageDisposable.dispose();
      panel = null;
    });
  });

  context.subscriptions.push(openCommand);
}

async function handleWebviewRequest(request: WebviewRequest): Promise<unknown> {
  switch (request.method) {
    case "vscode.showOpenDialog": {
      const params = request.params as
        | {
            canSelectFiles?: boolean;
            canSelectFolders?: boolean;
            canSelectMany?: boolean;
            title?: string;
            defaultUri?: string;
          }
        | undefined;
      const options: vscode.OpenDialogOptions = {
        canSelectFiles: params?.canSelectFiles ?? true,
        canSelectFolders: params?.canSelectFolders ?? false,
        canSelectMany: params?.canSelectMany ?? false,
        title: params?.title,
      };
      if (params?.defaultUri) {
        options.defaultUri = vscode.Uri.file(params.defaultUri);
      }
      const result = await vscode.window.showOpenDialog(options);
      return result?.map((uri) => uri.fsPath) ?? null;
    }
    case "vscode.openFile": {
      const params = request.params as { path?: string; preview?: boolean } | undefined;
      if (!params?.path) {
        throw new Error("Missing file path");
      }
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(params.path)
      );
      await vscode.window.showTextDocument(document, {
        preview: params.preview ?? true,
      });
      return null;
    }
    default:
      throw new Error(`Unknown VS Code request: ${request.method}`);
  }
}

export function deactivate(): void {
  if (backendState?.process) {
    backendState.process.kill();
  }
  backendState = null;
}

async function ensureBackend(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel
): Promise<BackendState> {
  if (backendState) {
    return backendState;
  }

  const settings = loadMergedSettings();
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
    backendState = { ...externalBackend, process: null, settings };
    return backendState;
  }

  const port = await findAvailablePort();
  const authToken = crypto.randomBytes(16).toString("hex");
  const wsUrl = `ws://127.0.0.1:${port}`;

  const backendPath = resolveBackendPath(context, settings);
  if (!backendPath) {
    vscode.window.showErrorMessage(
      "Backend binary not found. Run `cargo build --manifest-path src-tauri/Cargo.toml` or set parallelCliRunner.backendPath."
    );
    backendState = { wsUrl, authToken, port, process: null, settings };
    return backendState;
  }

  const args = ["--port", String(port), "--auth-token", authToken, ...settings.backendArgs];
  output.appendLine(`Starting backend: ${backendPath} ${args.join(" ")}`);

  const child = spawn(backendPath, args, {
    env: { ...process.env, ...settings.backendEnv },
  });

  child.stdout.on("data", (data) => output.appendLine(data.toString()));
  child.stderr.on("data", (data) => output.appendLine(data.toString()));
  child.on("exit", (code) => output.appendLine(`Backend exited (${code ?? "unknown"})`));

  const ready = await waitForBackendReady(wsUrl, authToken, output);
  if (!ready) {
    child.kill();
    throw new Error("Backend did not respond to WebSocket handshake.");
  }

  backendState = { wsUrl, authToken, port, process: child, settings };
  return backendState;
}

function getExternalBackend(): { wsUrl: string; authToken: string; port: number } | null {
  const wsUrl = process.env[ENV_WS_URL];
  const authToken = process.env[ENV_AUTH_TOKEN];
  if (!wsUrl || !authToken) {
    return null;
  }

  const parsed = parseWsUrl(wsUrl);
  if (!parsed) {
    void vscode.window.showWarningMessage(
      `Invalid ${ENV_WS_URL} value. Falling back to spawning the backend.`
    );
    return null;
  }

  return { wsUrl: parsed.wsUrl, authToken, port: parsed.port };
}

function resolveBackendPath(
  context: vscode.ExtensionContext,
  settings: ExtensionSettings
): string | null {
  if (settings.backendPath && fs.existsSync(settings.backendPath)) {
    return settings.backendPath;
  }

  const devPath = getDevBackendPath(context);
  if (devPath && fs.existsSync(devPath)) {
    return devPath;
  }

  const bundled = getBundledBackendPath(context);
  if (bundled && fs.existsSync(bundled)) {
    return bundled;
  }

  return null;
}

function getDevBackendPath(context: vscode.ExtensionContext): string | null {
  if (context.extensionMode !== vscode.ExtensionMode.Development) {
    return null;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return null;
  }

  const binaryName = process.platform === "win32"
    ? "parallel-cli-runner.exe"
    : "parallel-cli-runner";
  return path.join(
    workspaceFolder.uri.fsPath,
    "src-tauri",
    "target",
    "debug",
    binaryName
  );
}

function getBundledBackendPath(context: vscode.ExtensionContext): string | null {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32" && arch === "x64") {
    return context.asAbsolutePath(path.join("bin", "win32-x64", "parallel-cli-runner.exe"));
  }
  if (platform === "darwin" && arch === "arm64") {
    return context.asAbsolutePath(path.join("bin", "darwin-arm64", "parallel-cli-runner"));
  }

  return null;
}

function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  backend: BackendState
): string {
  const webviewRoot = vscode.Uri.joinPath(extensionUri, "webview");
  const indexPath = vscode.Uri.joinPath(webviewRoot, "index.html");

  if (!fs.existsSync(indexPath.fsPath)) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
  </head>
  <body>
    <h1>Webview assets not found</h1>
    <p>Run: npm run frontend:build:vscode</p>
  </body>
</html>`;
  }

  let html = fs.readFileSync(indexPath.fsPath, "utf8");
  const nonce = crypto.randomBytes(16).toString("base64");
  const connectSrc = buildConnectSrc(backend.wsUrl);
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `connect-src ${connectSrc}`,
  ].join("; ");

  const runtimeConfig = {
    wsUrl: backend.wsUrl,
    authToken: backend.authToken,
    settings: backend.settings,
  };

  const configScript = `<script nonce="${nonce}">window.__APP_CONFIG__ = ${JSON.stringify(
    runtimeConfig
  )};</script>`;

  const bodyPaddingReset = `<style nonce="${nonce}">body{padding:0!important;}</style>`;
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  html = html.replace("</head>", `${cspMeta}\n${bodyPaddingReset}\n${configScript}\n</head>`);

  html = html.replace(/<script(\s[^>]*?)>/g, (match, attrs) => {
    if (/nonce=/.test(attrs)) {
      return match;
    }
    return `<script nonce="${nonce}"${attrs}>`;
  });

  html = html.replace(
    /(href|src)="(?!https?:|data:|vscode-resource:|vscode-webview-resource:)([^"]+)"/g,
    (_match, attr, value) => {
      const cleaned = value.replace(/^\.\//, "").replace(/^\//, "");
      const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, cleaned));
      return `${attr}="${assetUri}"`;
    }
  );

  return html;
}

function parseWsUrl(wsUrl: string): { wsUrl: string; port: number } | null {
  try {
    const url = new URL(wsUrl);
    const port = Number(url.port || "0");
    if (!Number.isFinite(port) || port <= 0) {
      return null;
    }
    return { wsUrl: url.toString(), port };
  } catch {
    return null;
  }
}

function buildConnectSrc(wsUrl: string): string {
  try {
    const url = new URL(wsUrl);
    return url.origin;
  } catch {
    return "ws://127.0.0.1:*";
  }
}

function loadMergedSettings(): ExtensionSettings {
  const defaults: ExtensionSettings = {
    backendPath: "",
    backendArgs: [],
    backendEnv: {},
  };

  const fileSettings = loadConfigFile();
  const vscodeOverrides = loadVscodeOverrides();

  return {
    ...defaults,
    ...fileSettings,
    ...vscodeOverrides,
  };
}

function loadConfigFile(): Partial<ExtensionSettings> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return {};
  }

  const configPath = vscode.Uri.joinPath(workspaceFolder.uri, CONFIG_FILE);
  if (!fs.existsSync(configPath.fsPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath.fsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as Partial<ExtensionSettings>;
  } catch (error) {
    void vscode.window.showWarningMessage(
      `Failed to parse ${CONFIG_FILE}: ${(error as Error).message}`
    );
    return {};
  }
}

function loadVscodeOverrides(): Partial<ExtensionSettings> {
  const config = vscode.workspace.getConfiguration("parallelCliRunner");
  const overrides: Partial<ExtensionSettings> = {};

  const backendPath = getConfiguredValue<string>(config, "backendPath");
  if (backendPath !== undefined) {
    overrides.backendPath = backendPath;
  }

  const backendArgs = getConfiguredValue<string[]>(config, "backendArgs");
  if (backendArgs !== undefined) {
    overrides.backendArgs = backendArgs;
  }

  const backendEnv = getConfiguredValue<Record<string, string>>(config, "backendEnv");
  if (backendEnv !== undefined) {
    overrides.backendEnv = backendEnv;
  }

  return overrides;
}

function getConfiguredValue<T>(
  config: vscode.WorkspaceConfiguration,
  key: string
): T | undefined {
  const inspect = config.inspect<T>(key);
  return inspect?.workspaceFolderValue ?? inspect?.workspaceValue ?? inspect?.globalValue;
}

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
