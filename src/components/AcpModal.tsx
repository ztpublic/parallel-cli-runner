import { X } from "lucide-react";
import { AcpAgentPanel } from "~/features/acp";

interface AcpModalProps {
  open: boolean;
  onClose: () => void;
}

export function AcpModal({ open, onClose }: AcpModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 w-[90vw] h-[85vh] bg-[--bg] border border-[--border-strong] rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[--border-strong]">
          <h2 className="text-lg font-semibold text-[--text-strong]">
            AI Agent
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[--surface-2] rounded transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-[--text]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <AcpAgentPanel />
        </div>
      </div>
    </div>
  );
}
