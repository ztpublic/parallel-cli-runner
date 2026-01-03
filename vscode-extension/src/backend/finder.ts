import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { ExtensionSettings } from "../types";

/**
 * Resolve the backend binary path from settings, dev build, or bundled binary
 */
export function resolveBackendPath(
  context: vscode.ExtensionContext,
  settings: ExtensionSettings
): string | null {
  // First check if a custom path is configured
  if (settings.backendPath && fs.existsSync(settings.backendPath)) {
    return settings.backendPath;
  }

  // Then check for dev build in workspace
  const devPath = getDevBackendPath(context);
  if (devPath && fs.existsSync(devPath)) {
    return devPath;
  }

  // Finally check for bundled binary
  const bundled = getBundledBackendPath(context);
  if (bundled && fs.existsSync(bundled)) {
    return bundled;
  }

  return null;
}

/**
 * Get the path to the development backend binary
 * Only available in development mode with a workspace folder
 */
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

/**
 * Get the path to the bundled backend binary for the current platform
 */
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
