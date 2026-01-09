import { useEffect } from "react";
import { getVscodeBridge } from "../platform/vscode";

export function useVscodeFocusTracking() {
  useEffect(() => {
    const bridge = getVscodeBridge();
    if (!bridge) return;

    // Track focus and blur events on the window
    const handleFocus = () => bridge.sendFocusChange(true);
    const handleBlur = () => bridge.sendFocusChange(false);

    // Listen for both window focus and document focus changes
    // This helps track when the webview itself receives/loses focus
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    // Also track visibility change (when user switches tabs in VSCode)
    document.addEventListener("visibilitychange", () => {
      bridge.sendFocusChange(!document.hidden);
    });

    // Send initial state
    bridge.sendFocusChange(document.hasFocus());

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);
}
