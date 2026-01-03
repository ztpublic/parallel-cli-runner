import * as fs from "fs";
import * as vscode from "vscode";
import type { ExtensionSettings } from "../types";
import { CONFIG_FILE } from "../types";

/**
 * Load settings from the workspace config file (.vscode/parallel-cli-runner.json)
 */
export function loadConfigFile(): Partial<ExtensionSettings> {
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

/**
 * Load settings from VS Code configuration (settings.json)
 */
export function loadVscodeOverrides(): Partial<ExtensionSettings> {
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

/**
 * Get a configured value from VS Code workspace configuration
 * Checks workspace folder, workspace, then global settings in that order
 */
function getConfiguredValue<T>(
  config: vscode.WorkspaceConfiguration,
  key: string
): T | undefined {
  const inspect = config.inspect<T>(key);
  return inspect?.workspaceFolderValue ?? inspect?.workspaceValue ?? inspect?.globalValue;
}
