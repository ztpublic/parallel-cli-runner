import * as vscode from "vscode";
import type { BackendState, WebviewRequest, WebviewResponse } from "./types";
import { ensureBackend, killBackend } from "./backend/manager";
import { buildWebviewHtml } from "./webview/html";
import { handleWebviewRequest } from "./webview/manager";

let panel: vscode.WebviewPanel | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Parallel CLI Runner");
  context.subscriptions.push(output);

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = "$(terminal) Parallel CLI Runner";
  statusBarItem.tooltip = "Open Parallel CLI Runner";
  statusBarItem.command = "parallelCliRunner.open";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

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
    panel.iconPath = {
      light: vscode.Uri.joinPath(context.extensionUri, "resources", "terminal-light.svg"),
      dark: vscode.Uri.joinPath(context.extensionUri, "resources", "terminal-dark.svg"),
    };

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

export function deactivate(): void {
  killBackend();
  panel = null;
}
