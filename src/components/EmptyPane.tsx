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
  }> = [
    {
      type: "terminal",
      icon: Terminal,
      label: "New Terminal",
    },
    {
      type: "agent",
      icon: Bot,
      label: "New Agent",
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
      <div className="flex gap-4 p-8">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              className="commit-button flex gap-2 h-auto py-4 px-6"
              onClick={() => onChoose(pane.id, option.type)}
            >
              <Icon className="w-5 h-5" size={20} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
