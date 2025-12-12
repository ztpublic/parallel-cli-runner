import { useEffect } from "react";

export function useDismissOnWindowClickOrEscape(dismiss: () => void) {
  useEffect(() => {
    const handleWindowClick = () => dismiss();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [dismiss]);
}

