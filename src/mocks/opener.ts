export async function openPath(path: string, openWith?: string): Promise<void> {
  console.log("[Tauri Mock] openPath", { path, openWith });
}

export async function openUrl(url: string | URL, openWith?: string): Promise<void> {
  console.log("[Tauri Mock] openUrl", { url, openWith });
}

export async function revealItemInDir(path: string | string[]): Promise<void> {
  console.log("[Tauri Mock] revealItemInDir", { path });
}
