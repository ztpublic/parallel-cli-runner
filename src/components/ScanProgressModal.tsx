import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

interface ScanProgressModalProps {
  open: boolean;
}

export function ScanProgressModal({ open }: ScanProgressModalProps) {
  const [currentPath, setCurrentPath] = useState<string>("");

  useEffect(() => {
    if (!open) return;

    // Reset path when opening
    setCurrentPath("");

    const unlistenPromise = listen<string>("scan-progress", (event) => {
      setCurrentPath(event.payload);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="scan-progress-overlay">
      <div className="scan-progress-modal">
        <div className="scan-progress-title">Scanning for Repositories...</div>
        <div className="scan-progress-path" title={currentPath}>
          {currentPath || "Starting scan..."}
        </div>
        <div className="scan-progress-bar">
          <div className="scan-progress-bar-fill" />
        </div>
      </div>
    </div>
  );
}
