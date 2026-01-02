import { useMemo, useState } from "react";
import { countPanes, LayoutNode } from "../types/layout";
import { ContextMenu } from "./ContextMenu";
import { Icon } from "./Icons";
import { LayoutRenderer } from "./LayoutRenderer";

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
  onNewPane: () => void;
  onSplitPane: () => void;
  onSetTerminalView: (
    tabId: string,
    view: "single" | "vertical" | "horizontal" | "quad"
  ) => void;
};

type TerminalView = "terminals" | "acp";

export function TerminalPanel({
  tabs,
  activeTabId,
  terminalSplitPaneIds,
  terminalSplitViews,
  layoutTick,
  onSetActiveTab,
  onSetActivePane,
  onCloseTab,
  onNewPane,
  onSplitPane,
  onSetTerminalView,
}: TerminalPanelProps) {
  const [activeView, setActiveView] = useState<TerminalView>("terminals");
  const [menuState, setMenuState] = useState<{
    tabId: string;
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
    ];
  }, [menuState, tabs, terminalSplitPaneIds, terminalSplitViews]);

  return (
    <section className="terminal-panel">
      <div className="terminal-topbar panel-header">
        <div className="terminal-view-tabs" role="tablist" aria-label="Right panel views">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "terminals"}
            className={`terminal-view-tab ${activeView === "terminals" ? "is-active" : ""}`}
            onClick={() => setActiveView("terminals")}
          >
            Terminals
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "acp"}
            className={`terminal-view-tab ${activeView === "acp" ? "is-active" : ""}`}
            onClick={() => setActiveView("acp")}
          >
            ACP Sessions
          </button>
        </div>
      </div>
      <div className="terminal-tabbar">
        {activeView === "terminals" ? (
          <>
            <div className="terminal-tabs" role="tablist" aria-label="Terminal sessions">
              {tabs.map((tab, index) => {
                const isActive = tab.id === activeTabId;
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
                    <Icon name="terminal" size={14} />
                    <span>{tab.title || `Terminal ${index + 1}`}</span>
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
                title="New terminal"
                onClick={onNewPane}
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
                  layoutTick={layoutTick}
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
          }}
        />
      ) : null}
    </section>
  );
}
