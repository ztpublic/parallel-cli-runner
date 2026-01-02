export type AppConfig = {
  wsUrl?: string;
  authToken?: string;
  workspacePath?: string;
  settings?: Record<string, unknown>;
};

declare global {
  interface Window {
    __APP_CONFIG__?: AppConfig;
  }
}

const defaultConfig: AppConfig = {
  wsUrl: "",
  authToken: "",
  workspacePath: "",
  settings: {},
};

export function getAppConfig(): AppConfig {
  if (typeof window === "undefined") {
    return { ...defaultConfig };
  }
  return window.__APP_CONFIG__ ?? { ...defaultConfig };
}
