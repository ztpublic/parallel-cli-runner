import { useEffect } from "react";

export function useClosePaneHotkey(closeActivePane: () => void | Promise<void>) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;
      if (event.code !== "KeyW") return;
      event.preventDefault();
      void closeActivePane();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeActivePane]);
}

