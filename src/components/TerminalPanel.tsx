import { useMemo, useState } from "react";
import { countPanes, collectPanes, type LayoutNode } from "../types/layout";
import { clearTerminalBuffer } from "../services/terminalRegistry";
import { ContextMenu } from "./ContextMenu";
import { Icon } from "./Icons";
import { LayoutRenderer } from "./LayoutRenderer";
import { DEFAULT_AGENT } from "~/constants/agents";
import type { RepoInfoDto } from "../types/git";
import type { WorktreeItem } from "../types/git-ui";

type TerminalTab = {
  id: string;
  title: string;
  layout: LayoutNode;
  activePaneId: string | null;
};

type TerminalPanelProps = {
  tabs: TerminalTab[];
  activeTabId: string | null;
  terminalSplitPaneIds: Record<string, string[]>;
  terminalSplitViews: Record<string, "single" | "vertical" | "horizontal" | "quad">;
  layoutTick: number;
  onSetActiveTab: (id: string) => void;
  onSetActivePane: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseActivePane?: () => void;
  onNewPane: () => void;
  onNewAgentTab?: (agentId: string) => void;
  onChooseEmptyPane?: (paneId: string, paneType: "terminal" | "agent", cwd?: string) => void;
  onSetTerminalView: (
    tabId: string,
    view: "single" | "vertical" | "horizontal" | "quad"
  ) => void;
  repos?: RepoInfoDto[];
  worktreesByRepo?: Record<string, WorktreeItem[]>;
};

type TerminalView = "terminals" | "acp";

// Helper to extract session IDs from a layout node
function getSessionIdsFromLayout(node: LayoutNode): string[] {
  if (node.type === "pane") {
    return node.sessionId ? [node.sessionId] : [];
  } else if (node.type === "split") {
    return [
      ...getSessionIdsFromLayout(node.children[0]),
      ...getSessionIdsFromLayout(node.children[1]),
    ];
  }
  return [];
}

// Helper to get the primary pane type for a tab
function getTabPrimaryType(tab: TerminalTab): "agent" | "terminal" {
  const panes = collectPanes(tab.layout);
  const activePane = panes.find((p) => p.id === tab.activePaneId);
  if (activePane?.paneType === "agent") return "agent";
  if (panes.some((p) => p.paneType === "agent")) return "agent";
  return "terminal";
}

export function TerminalPanel({
  tabs,
  activeTabId,
  terminalSplitPaneIds,
  terminalSplitViews,
  layoutTick,
  onSetActiveTab,
  onSetActivePane,
  onCloseTab,
  onCloseActivePane,
  onNewPane,
  onNewAgentTab,
  onChooseEmptyPane,
  onSetTerminalView,
  repos = [],
  worktreesByRepo = {},
}: TerminalPanelProps) {
  const activeView: TerminalView = "terminals";
  const [menuState, setMenuState] = useState<{
    tabId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [newTabDropdown, setNewTabDropdown] = useState<{
    position: { x: number; y: number };
  } | null>(null);

  const menuItems = useMemo(() => {
    if (!menuState) return [];
    const tab = tabs.find((item) => item.id === menuState.tabId);
    const view = terminalSplitViews[menuState.tabId] ?? "single";
    const splitPaneIds = terminalSplitPaneIds[menuState.tabId] ?? [];
    const hasSplitPanes = Boolean(splitPaneIds.length) && (tab ? countPanes(tab.layout) > 1 : false);
    return [
      { id: "view", label: "View", type: "separator" as const },
      { id: "single", label: "Single view", type: "radio" as const, selected: view === "single" || !hasSplitPanes },
      {
        id: "vertical",
        label: "Vertical split view",
        type: "radio" as const,
        selected: view === "vertical" && hasSplitPanes,
      },
      {
        id: "horizontal",
        label: "Horizontal split view",
        type: "radio" as const,
        selected: view === "horizontal" && hasSplitPanes,
      },
      {
        id: "quad",
        label: "4 split view",
        type: "radio" as const,
        selected: view === "quad" && hasSplitPanes,
      },
      { id: "actions", label: "Actions", type: "separator" as const },
      { id: "clear-buffer", label: "Clear buffer" },
    ];
  }, [menuState, tabs, terminalSplitPaneIds, terminalSplitViews]);

  return (
    <>
    <section className="terminal-panel">
      <div className="terminal-tabbar">
        {activeView === "terminals" ? (
          <>
            <div className="terminal-tabs" role="tablist" aria-label="Terminal sessions">
              {tabs.map((tab, index) => {
                const isActive = tab.id === activeTabId;
                const tabType = getTabPrimaryType(tab);
                return (
                  <div
                    key={tab.id}
                    className={`terminal-tab ${isActive ? "is-active" : ""}`}
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    onClick={() => onSetActiveTab(tab.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSetActiveTab(tab.id);
                      }
                    }}
                  >
                    <Icon name={tabType === "agent" ? "robot" : "terminal"} size={14} />
                    <span>{tab.title || `${tabType === "agent" ? "Agent" : "Terminal"} ${index + 1}`}</span>
                    <button
                      type="button"
                      className="terminal-tab-menu"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSetActiveTab(tab.id);
                        const rect = event.currentTarget.getBoundingClientRect();
                        setMenuState({
                          tabId: tab.id,
                          position: { x: rect.left, y: rect.bottom + 6 },
                        });
                      }}
                      title="Terminal options"
                    >
                      <Icon name="ellipsis" size={14} />
                    </button>
                    <button
                      type="button"
                      className="terminal-tab-close"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCloseTab(tab.id);
                      }}
                      title="Close terminal"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="terminal-actions">
              <button
                type="button"
                className="icon-button"
                title="New tab"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setNewTabDropdown({
                    position: { x: rect.left, y: rect.bottom + 6 },
                  });
                }}
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="terminal-tabbar-placeholder" aria-hidden="true">
            ACP Sessions
          </div>
        )}
      </div>
      <section className="terminal-shell">
        {tabs.length ? (
          tabs.map((tab) => {
            const isActiveTab = tab.id === activeTabId;
            const isHidden = activeView !== "terminals" || !isActiveTab;
            return (
              <div
                key={tab.id}
                className={`terminal-shell-body ${isHidden ? "is-hidden" : ""}`}
              >
                <LayoutRenderer
                  node={tab.layout}
                  activePaneId={isActiveTab ? tab.activePaneId : null}
                  onFocus={onSetActivePane}
                  onChooseEmptyPane={onChooseEmptyPane}
                  layoutTick={layoutTick}
                  onClose={isActiveTab ? onCloseActivePane : undefined}
                  repos={repos}
                  worktreesByRepo={worktreesByRepo}
                />
              </div>
            );
          })
        ) : activeView === "terminals" ? (
          <div className="terminal-placeholder">No terminals yet. Use + to start one.</div>
        ) : null}
        {activeView === "terminals" ? null : (
          <div className="terminal-placeholder">ACP Sessions content will be added later.</div>
        )}
      </section>
      {menuState ? (
        <ContextMenu
          items={menuItems}
          position={menuState.position}
          onClose={() => setMenuState(null)}
          onSelect={(itemId) => {
            if (itemId === "single") {
              onSetTerminalView(menuState.tabId, "single");
            }
            if (itemId === "vertical") {
              onSetTerminalView(menuState.tabId, "vertical");
            }
            if (itemId === "horizontal") {
              onSetTerminalView(menuState.tabId, "horizontal");
            }
            if (itemId === "quad") {
              onSetTerminalView(menuState.tabId, "quad");
            }
            if (itemId === "clear-buffer") {
              const tab = tabs.find((item) => item.id === menuState.tabId);
              if (tab) {
                const sessionIds = getSessionIdsFromLayout(tab.layout);
                for (const sessionId of sessionIds) {
                  clearTerminalBuffer(sessionId);
                }
              }
            }
          }}
        />
      ) : null}
      {newTabDropdown ? (
        <ContextMenu
          items={[
            {
              id: "new-terminal",
              label: "New Terminal Tab",
            },
            {
              id: "new-agent",
              label: "New Agent Tab",
            },
          ]}
          position={newTabDropdown.position}
          onClose={() => setNewTabDropdown(null)}
          onSelect={(itemId) => {
            if (itemId === "new-terminal") {
              onNewPane();
            }
            if (itemId === "new-agent") {
              if (onNewAgentTab) {
                onNewAgentTab(DEFAULT_AGENT);
              }
              setNewTabDropdown(null);
              return;
            }
            setNewTabDropdown(null);
          }}
        />
      ) : null}
    </section>
  </>
  );
}
