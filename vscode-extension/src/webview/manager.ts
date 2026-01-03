import * as vscode from "vscode";
import type { WebviewRequest } from "../types";

/**
 * Handle a request from the webview
 * Routes the request to the appropriate VS Code API
 */
export async function handleWebviewRequest(request: WebviewRequest): Promise<unknown> {
  switch (request.method) {
    case "vscode.showOpenDialog": {
      return handleShowOpenDialog(request.params);
    }
    case "vscode.openFile": {
      return handleOpenFile(request.params);
    }
    default:
      throw new Error(`Unknown VS Code request: ${request.method}`);
  }
}

/**
 * Handle the vscode.showOpenDialog request
 */
async function handleShowOpenDialog(params: unknown): Promise<string[] | null> {
  const options: vscode.OpenDialogOptions = {
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
  };

  if (params && typeof params === "object") {
    const p = params as {
      canSelectFiles?: boolean;
      canSelectFolders?: boolean;
      canSelectMany?: boolean;
      title?: string;
      defaultUri?: string;
    };
    if (p.canSelectFiles !== undefined) options.canSelectFiles = p.canSelectFiles;
    if (p.canSelectFolders !== undefined) options.canSelectFolders = p.canSelectFolders;
    if (p.canSelectMany !== undefined) options.canSelectMany = p.canSelectMany;
    if (p.title !== undefined) options.title = p.title;
    if (p.defaultUri !== undefined) {
      options.defaultUri = vscode.Uri.file(p.defaultUri);
    }
  }

  const result = await vscode.window.showOpenDialog(options);
  return result?.map((uri) => uri.fsPath) ?? null;
}

/**
 * Handle the vscode.openFile request
 */
async function handleOpenFile(params: unknown): Promise<null> {
  if (!params || typeof params !== "object") {
    throw new Error("Missing file path");
  }

  const p = params as { path?: string; preview?: boolean };
  if (!p.path) {
    throw new Error("Missing file path");
  }

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(p.path));
  await vscode.window.showTextDocument(document, {
    preview: p.preview ?? true,
  });
  return null;
}
