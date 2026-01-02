import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
const useTauriMock = process.env.TAURI_MOCK === "1";

export default defineConfig(async ({ mode }) => {
  const isVscodeWebview = mode === "vscode";

  return {
  plugins: [react()],
  resolve: {
    alias: useTauriMock
      ? {
          "@tauri-apps/api/core": fileURLToPath(new URL("./src/mocks/tauri.ts", import.meta.url)),
          "@tauri-apps/api/event": fileURLToPath(new URL("./src/mocks/tauri.ts", import.meta.url)),
          "@tauri-apps/plugin-dialog": fileURLToPath(
            new URL("./src/mocks/dialog.ts", import.meta.url),
          ),
          "@tauri-apps/plugin-opener": fileURLToPath(
            new URL("./src/mocks/opener.ts", import.meta.url),
          ),
        }
      : undefined,
  },

  base: isVscodeWebview ? "./" : undefined,
  build: isVscodeWebview
    ? {
        outDir: "vscode-extension/webview",
        emptyOutDir: true,
      }
    : undefined,

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  };
});
