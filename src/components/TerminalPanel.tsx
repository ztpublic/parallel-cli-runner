import { useState } from "react";
import { LayoutNode } from "../types/layout";
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
  onSetActiveTab: (id: string) => void;
  onSetActivePane: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewPane: () => void;
  onSplitPane: () => void;
};

type TerminalView = "terminals" | "acp";

export function TerminalPanel({
  tabs,
  activeTabId,
  onSetActiveTab,
  onSetActivePane,
  onCloseTab,
  onNewPane,
  onSplitPane,
}: TerminalPanelProps) {
  const [activeView, setActiveView] = useState<TerminalView>("terminals");

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
              <button
                type="button"
                className="icon-button"
                title="Split terminal"
                onClick={onSplitPane}
              >
                <Icon name="split" size={16} />
              </button>
              <button type="button" className="icon-button" title="Terminal settings">
                <Icon name="settings" size={16} />
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
    </section>
  );
}
