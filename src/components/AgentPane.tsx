import { useEffect, useRef } from "react";
import { PaneNode } from "../types/layout";
import { AcpAgentPanel } from "~/features/acp";

interface AgentPaneProps {
  pane: PaneNode;
  isActive: boolean;
  onFocused: (paneId: string) => void;
}

/**
 * AgentPane - ACP agent chat wrapped in the tab/pane layout.
 */
export function AgentPane({ pane, isActive, onFocused }: AgentPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Handle focus when pane becomes active
  useEffect(() => {
    if (isActive && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isActive]);

  return (
    <div
      className={`pane pane-agent dark ${isActive ? "pane-active" : ""}`}
      ref={containerRef}
      tabIndex={0}
      onClick={() => onFocused(pane.id)}
    >
      <div className="pane-agent-content h-full">
        <AcpAgentPanel agentId={pane.agentId} cwd={pane.meta?.cwd} />
      </div>
    </div>
  );
}
