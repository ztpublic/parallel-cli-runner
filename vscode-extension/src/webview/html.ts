import * as crypto from "crypto";
import * as fs from "fs";
import * as vscode from "vscode";
import type { BackendState } from "../types";
import { buildConnectSrc } from "../backend/external";

/**
 * Build the webview HTML with injected configuration and CSP
 */
export function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  backend: BackendState
): string {
  const webviewRoot = vscode.Uri.joinPath(extensionUri, "webview");
  const indexPath = vscode.Uri.joinPath(webviewRoot, "index.html");

  // Show error if webview assets are not built
  if (!fs.existsSync(indexPath.fsPath)) {
    return getErrorHtml();
  }

  let html = fs.readFileSync(indexPath.fsPath, "utf8");
  const nonce = crypto.randomBytes(16).toString("base64");
  const connectSrc = buildConnectSrc(backend.wsUrl);
  const csp = buildCsp(webview, nonce, connectSrc);

  const runtimeConfig = {
    wsUrl: backend.wsUrl,
    authToken: backend.authToken,
    workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
    settings: backend.settings,
  };

  html = injectConfig(html, runtimeConfig, nonce);
  html = injectBodyPaddingReset(html, nonce);
  html = injectCspMeta(html, csp);
  html = addScriptNonces(html, nonce);
  html = rewriteAssetPaths(html, webview, webviewRoot);

  return html;
}

/**
 * Get the error HTML shown when webview assets are not built
 */
function getErrorHtml(): string {
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

/**
 * Build the Content-Security-Policy meta tag value
 */
function buildCsp(webview: vscode.Webview, nonce: string, connectSrc: string): string {
  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `connect-src ${connectSrc}`,
  ].join("; ");
}

/**
 * Inject the runtime configuration script into the HTML head
 */
function injectConfig(html: string, config: Record<string, unknown>, nonce: string): string {
  const configScript = `<script nonce="${nonce}">window.__APP_CONFIG__ = ${JSON.stringify(
    config
  )};</script>`;
  return html.replace("</head>", `${configScript}\n</head>`);
}

/**
 * Inject body padding reset to remove default margins
 */
function injectBodyPaddingReset(html: string, nonce: string): string {
  const bodyPaddingReset = `<style nonce="${nonce}">body{padding:0!important;}</style>`;
  return html.replace("</head>", `${bodyPaddingReset}\n</head>`);
}

/**
 * Inject the CSP meta tag
 */
function injectCspMeta(html: string, csp: string): string {
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  return html.replace("</head>", `${cspMeta}\n</head>`);
}

/**
 * Add nonce attributes to all script tags that don't already have one
 */
function addScriptNonces(html: string, nonce: string): string {
  return html.replace(/<script(\s[^>]*?)>/g, (match, attrs) => {
    if (/nonce=/.test(attrs)) {
      return match;
    }
    return `<script nonce="${nonce}"${attrs}>`;
  });
}

/**
 * Rewrite asset paths to use webview URIs
 */
function rewriteAssetPaths(
  html: string,
  webview: vscode.Webview,
  webviewRoot: vscode.Uri
): string {
  return html.replace(
    /(href|src)="(?!https?:|data:|vscode-resource:|vscode-webview-resource:)([^"]+)"/g,
    (_match, attr, value) => {
      const cleaned = value.replace(/^\.\//, "").replace(/^\//, "");
      const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, cleaned));
      return `${attr}="${assetUri}"`;
    }
  );
}
