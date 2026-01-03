import * as vscode from "vscode";
import { ENV_WS_URL, ENV_AUTH_TOKEN } from "../types";

/**
 * Get external backend configuration from environment variables
 * Returns null if not configured or if the URL is invalid
 */
export function getExternalBackend(): { wsUrl: string; authToken: string; port: number } | null {
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

/**
 * Parse a WebSocket URL and extract the URL and port
 * Returns null if the URL is invalid or the port is not a positive number
 */
export function parseWsUrl(wsUrl: string): { wsUrl: string; port: number } | null {
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

/**
 * Build the connect-src CSP value from a WebSocket URL
 * Returns the origin of the URL, or a fallback if parsing fails
 */
export function buildConnectSrc(wsUrl: string): string {
  try {
    const url = new URL(wsUrl);
    return url.origin;
  } catch {
    return "ws://127.0.0.1:*";
  }
}
