import { Icon } from "./Icons";

export function TopBar() {
  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button type="button" className="icon-button" aria-label="Main menu">
          <Icon name="menu" size={16} />
        </button>
        <div className="top-bar-title">Code Agent CLI Runner</div>
        <nav className="top-bar-menu" aria-label="Primary">
          <button type="button" className="menu-item">
            File
          </button>
          <button type="button" className="menu-item">
            Edit
          </button>
          <button type="button" className="menu-item">
            View
          </button>
          <button type="button" className="menu-item">
            Git
          </button>
          <button type="button" className="menu-item">
            Terminal
          </button>
        </nav>
      </div>
      <div className="top-bar-spacer" />
      <div className="top-bar-actions">
        <button type="button" className="icon-button" title="Run session">
          <Icon name="play" size={15} />
        </button>
        <button type="button" className="icon-button" title="Branch actions">
          <Icon name="branch" size={16} />
        </button>
        <button type="button" className="icon-button" title="Terminal actions">
          <Icon name="terminal" size={16} />
        </button>
        <button type="button" className="icon-button" title="Settings">
          <Icon name="settings" size={16} />
        </button>
      </div>
    </header>
  );
}
