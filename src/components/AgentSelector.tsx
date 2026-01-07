import { useState } from "react";
import { AVAILABLE_AGENTS, DEFAULT_AGENT } from "~/constants/agents";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Icon } from "./Icons";

interface AgentSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAgent: (agentName: string) => void;
}

/**
 * AgentSelector - Dialog for selecting an AI agent when creating a new agent tab
 *
 * Shows a list of available ACP agents with icons, names, and descriptions.
 * User can select an agent to create a new agent pane.
 */
export function AgentSelector({
  open,
  onOpenChange,
  onSelectAgent,
}: AgentSelectorProps) {
  const [selectedAgent, setSelectedAgent] = useState<string>(DEFAULT_AGENT);

  const handleSelect = () => {
    onSelectAgent(selectedAgent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select AI Agent</DialogTitle>
          <DialogDescription>
            Choose an AI agent to start a new conversation. Each agent supports
            the ACP (Agent Client Protocol).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="grid gap-3 py-4">
            {AVAILABLE_AGENTS.map((agent) => {
              const isSelected = selectedAgent === agent.name;
              return (
                <button
                  key={agent.name}
                  type="button"
                  onClick={() => setSelectedAgent(agent.name)}
                  className={`
                    flex items-start gap-4 w-full text-left p-4 rounded-lg border-2 transition-all
                    ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }
                  `}
                >
                  {agent.meta?.icon ? (
                    <img
                      src={agent.meta.icon}
                      alt=""
                      className="w-12 h-12 rounded-md flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon name="robot" size={24} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{agent.name}</h3>
                      {isSelected && (
                        <span className="text-xs text-primary font-medium">
                          ✓ Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {agent.configHint}
                    </p>
                    {agent.configLink && (
                      <a
                        href={agent.configLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Learn more →
                      </a>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSelect}>
            Create Agent Tab
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
