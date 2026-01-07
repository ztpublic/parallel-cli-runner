import { Terminal, Bot, type LucideIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { PaneNode } from "../types/layout";

interface EmptyPaneProps {
  pane: PaneNode;
  onChoose: (paneId: string, paneType: "terminal" | "agent") => void;
}

/**
 * EmptyPane - Placeholder for newly split empty panes
 *
 * Renders a placeholder UI with buttons to create a Terminal or Agent pane.
 * This appears when a split creates an empty pane slot.
 */
export function EmptyPane({ pane, onChoose }: EmptyPaneProps) {
  const options: Array<{
    type: "terminal" | "agent";
    icon: LucideIcon;
    label: string;
    description: string;
    shortcut: string;
  }> = [
    {
      type: "terminal",
      icon: Terminal,
      label: "New Terminal",
      description: "Open a new terminal session",
      shortcut: "T",
    },
    {
      type: "agent",
      icon: Bot,
      label: "New Agent",
      description: "Open a new AI agent chat",
      shortcut: "A",
    },
  ];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "t" || e.key === "T") {
      onChoose(pane.id, "terminal");
    } else if (e.key === "a" || e.key === "A") {
      onChoose(pane.id, "agent");
    }
  };

  return (
    <div
      className={cn(
        "pane pane-empty flex items-center justify-center",
        "bg-[var(--terminal-bg)]"
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col items-center gap-6 p-8 text-center">
        <div className="text-muted-foreground">
          <p className="text-sm">Choose what to open in this pane</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.type}
                variant="outline"
                size="lg"
                className="flex flex-col gap-2 h-auto py-6 px-8 min-w-[160px]"
                onClick={() => onChoose(pane.id, option.type)}
              >
                <Icon className="w-6 h-6" />
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
                <kbd className="text-xs bg-muted px-2 py-1 rounded mt-1">
                  {option.shortcut}
                </kbd>
              </Button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Press <kbd className="bg-muted px-1 rounded">T</kbd> for Terminal or{" "}
          <kbd className="bg-muted px-1 rounded">A</kbd> for Agent
        </p>
      </div>
    </div>
  );
}
import type { KeyboardEvent } from "react";
