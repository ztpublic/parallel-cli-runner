import { getAppConfig } from "./config";
import { getTransport } from "./transport";

export type OpenDialogOptions = {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
};

export async function openDialog(
  options?: OpenDialogOptions
): Promise<string | string[] | null> {
  const config = getAppConfig();
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
