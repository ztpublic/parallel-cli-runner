import { Terminal, Bot, ChevronDown, type LucideIcon } from "lucide-react";
import React, { type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "~/lib/utils";
import type { PaneNode } from "../types/layout";
import type { RepoInfoDto } from "../types/git";
import type { WorktreeItem } from "../types/git-ui";

interface EmptyPaneProps {
  pane: PaneNode;
  onChoose: (paneId: string, paneType: "terminal" | "agent", cwd?: string) => void;
  repos: RepoInfoDto[];
  worktreesByRepo: Record<string, WorktreeItem[]>;
}

/**
 * EmptyPane - Placeholder for newly split empty panes
 *
 * Renders a placeholder UI with buttons to create a Terminal or Agent pane.
 * This appears when a split creates an empty pane slot.
 */
export function EmptyPane({ pane, onChoose, repos, worktreesByRepo }: EmptyPaneProps) {
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

  // Collect all available directories (repos and worktrees)
  const getAvailableDirectories = (): string[] => {
    const directories: string[] = [];

    // Add all repo root paths
    repos.forEach((repo) => {
      directories.push(repo.root_path);
    });

    // Add all worktree paths
    Object.values(worktreesByRepo).forEach((worktrees) => {
      worktrees.forEach((worktree) => {
        directories.push(worktree.path);
      });
    });

    // Remove duplicates and sort
    return Array.from(new Set(directories)).sort();
  };

  const availableDirectories = getAvailableDirectories();

  // Get initial directory from pane meta or use first available
  const getInitialDirectory = (): string => {
    if (pane.meta?.cwd) return pane.meta.cwd;
    if (availableDirectories.length > 0) return availableDirectories[0];
    return "";
  };

  const [selectedDirectory, setSelectedDirectory] = React.useState(getInitialDirectory);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "t" || e.key === "T") {
      onChoose(pane.id, "terminal", selectedDirectory);
    } else if (e.key === "a" || e.key === "A") {
      onChoose(pane.id, "agent", selectedDirectory);
    }
  };

  const handleDirectorySelect = (directory: string) => {
    setSelectedDirectory(directory);
    setIsDropdownOpen(false);
  };

  const handleToggleDropdown = (e: MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen((prev) => !prev);
  };

  return (
    <div
      className={cn(
        "pane pane-empty flex flex-col items-center justify-center gap-4",
        "bg-[var(--terminal-bg)]"
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => setIsDropdownOpen(false)}
    >
      {/* Directory Input with Dropdown */}
      <div className="relative w-full max-w-md px-8">
        <div className="flex items-center bg-[var(--terminal-bg)] border border-[var(--border-color)] rounded-md">
          <input
            type="text"
            value={selectedDirectory}
            onChange={(e) => setSelectedDirectory(e.target.value)}
            placeholder="Enter directory path"
            className="flex-1 bg-transparent px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={handleToggleDropdown}
            className="px-3 py-2 hover:bg-[var(--hover-bg)] rounded-r-md focus:outline-none"
          >
            <ChevronDown className={cn(
              "w-4 h-4 text-[var(--text-color)] transition-transform",
              isDropdownOpen && "transform rotate-180"
            )} />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isDropdownOpen && availableDirectories.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-[var(--terminal-bg)] border border-[var(--border-color)] rounded-md shadow-lg max-h-60 overflow-auto">
            {availableDirectories.map((directory) => (
              <button
                key={directory}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDirectorySelect(directory);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-[var(--hover-bg)]",
                  "focus:outline-none focus:bg-[var(--hover-bg)]",
                  selectedDirectory === directory && "bg-[var(--hover-bg)]"
                )}
              >
                {directory}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-4 p-8">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              className="commit-button flex gap-2 h-auto py-4 px-6"
              onClick={() => onChoose(pane.id, option.type, selectedDirectory)}
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
