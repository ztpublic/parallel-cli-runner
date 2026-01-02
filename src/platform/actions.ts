import { getAppConfig } from "./config";
import { getTransport } from "./transport";
import { getVscodeBridge } from "./vscode";

export type OpenDialogOptions = {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
};

export async function openDialog(
  options?: OpenDialogOptions
): Promise<string | string[] | null> {
  const config = getAppConfig();
  const vscodeBridge = getVscodeBridge();
  if (vscodeBridge) {
    const result = await vscodeBridge.request<string[] | null>("vscode.showOpenDialog", {
      canSelectFiles: !options?.directory,
      canSelectFolders: Boolean(options?.directory),
      canSelectMany: Boolean(options?.multiple),
      title: options?.title,
    });
    if (!result || result.length === 0) {
      return null;
    }
    if (options?.multiple) {
      return result;
    }
    return result[0] ?? null;
  }
  if (config.wsUrl) {
    return getTransport().request<string | string[] | null>(
      "dialog.open",
      options ?? {}
    );
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  return open(options);
}

export async function openPath(path: string, openWith?: string): Promise<void> {
  const config = getAppConfig();
  if (config.wsUrl) {
    await getTransport().request<void>("shell.openPath", { path, openWith });
    return;
  }

  const { openPath: tauriOpenPath } = await import("@tauri-apps/plugin-opener");
  await tauriOpenPath(path, openWith);
}

export async function openFileInEditor(
  path: string,
  options?: { preview?: boolean }
): Promise<void> {
  const vscodeBridge = getVscodeBridge();
  if (vscodeBridge) {
    await vscodeBridge.request<void>("vscode.openFile", {
      path,
      preview: options?.preview,
    });
    return;
  }

  await openPath(path, "Visual Studio Code");
}
