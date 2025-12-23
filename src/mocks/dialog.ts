type OpenDialogOptions = {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
};

export async function open(options?: OpenDialogOptions): Promise<string | string[] | null> {
  console.log("[Tauri Mock] dialog open", options);
  return null;
}
