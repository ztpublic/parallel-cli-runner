import type { ChildProcess } from "child_process";

export const CONFIG_FILE = ".vscode/parallel-cli-runner.json";

export const ENV_WS_URL = "PARALLEL_CLI_RUNNER_WS_URL";
export const ENV_AUTH_TOKEN = "PARALLEL_CLI_RUNNER_AUTH_TOKEN";

export type ExtensionSettings = {
  backendPath: string;
  backendArgs: string[];
  backendEnv: Record<string, string>;
};

export type BackendState = {
  wsUrl: string;
  authToken: string;
  port: number;
  process: ChildProcess | null;
  settings: ExtensionSettings;
};

export type WebviewRequest = {
  type: "vscode-request";
  id: string;
  method: string;
  params?: unknown;
};

export type WebviewResponse = {
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
