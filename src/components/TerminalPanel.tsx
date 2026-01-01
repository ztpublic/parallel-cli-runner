import { useState } from "react";
import { LayoutNode, PaneNode } from "../types/layout";
import { Icon } from "./Icons";
import { LayoutRenderer } from "./LayoutRenderer";

type TerminalPanelProps = {
  layout: LayoutNode | null;
  panes: PaneNode[];
  activePaneId: string | null;
  onSetActivePane: (id: string) => void;
  onClosePane: (id: string) => void;
  onNewPane: () => void;
  onSplitPane: () => void;
};

type TerminalView = "terminals" | "acp";

export function TerminalPanel({
  layout,
  panes,
  activePaneId,
  onSetActivePane,
  onClosePane,
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
              {panes.map((pane, index) => {
                const isActive = pane.id === activePaneId;
                return (
                  <div
                    key={pane.id}
                    className={`terminal-tab ${isActive ? "is-active" : ""}`}
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    onClick={() => onSetActivePane(pane.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSetActivePane(pane.id);
                      }
                    }}
                  >
                    <Icon name="terminal" size={14} />
                    <span>{pane.meta?.title ?? `Terminal ${index + 1}`}</span>
                    {panes.length > 1 ? (
                      <button
                        type="button"
                        className="terminal-tab-close"
                        onClick={(event) => {
                          event.stopPropagation();
                          onClosePane(pane.id);
                        }}
                        title="Close terminal"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    ) : null}
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
        <div
          className={
            activeView === "terminals"
              ? "terminal-shell-body"
              : "terminal-shell-body is-hidden"
          }
        >
          {layout ? (
            <LayoutRenderer
              node={layout}
              activePaneId={activePaneId}
              onFocus={onSetActivePane}
            />
          ) : (
            <div className="loading">Booting terminal session…</div>
          )}
        </div>
        {activeView === "terminals" ? null : (
          <div className="terminal-placeholder">ACP Sessions content will be added later.</div>
        )}
      </section>
    </section>
  );
}
