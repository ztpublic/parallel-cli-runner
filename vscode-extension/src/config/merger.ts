import type { ExtensionSettings } from "../types";
import { loadConfigFile, loadVscodeOverrides } from "./loader";

/**
 * Load and merge settings from all sources with proper priority:
 * 1. Default values
 * 2. Workspace config file (.vscode/parallel-cli-runner.json)
 * 3. VS Code settings (settings.json)
 */
export function loadMergedSettings(): ExtensionSettings {
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

export { loadConfigFile, loadVscodeOverrides } from "./loader";
