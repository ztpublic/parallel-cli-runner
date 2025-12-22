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
};

export function TerminalPanel({
  layout,
  panes,
  activePaneId,
  onSetActivePane,
  onClosePane,
  onNewPane,
}: TerminalPanelProps) {
  return (
    <section className="terminal-panel">
      <div className="terminal-header">
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
            onClick={onNewPane}
          >
            <Icon name="split" size={16} />
          </button>
          <button type="button" className="icon-button" title="Terminal settings">
            <Icon name="settings" size={16} />
          </button>
        </div>
      </div>
      <section className="terminal-shell">
        {layout ? (
          <LayoutRenderer
            node={layout}
            activePaneId={activePaneId}
            onFocus={onSetActivePane}
          />
        ) : (
          <div className="loading">Booting terminal session…</div>
        )}
      </section>
    </section>
  );
}
