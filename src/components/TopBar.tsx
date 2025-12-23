import { useEffect, useRef, useState } from "react";

import { Icon } from "./Icons";

export function TopBar() {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isFileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!fileMenuRef.current?.contains(event.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isFileMenuOpen]);

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <nav className="top-bar-menu" aria-label="Primary">
          <div className="menu-item-wrapper" ref={fileMenuRef}>
            <button
              type="button"
              className="menu-item"
              aria-haspopup="menu"
              aria-expanded={isFileMenuOpen}
              onClick={() => setIsFileMenuOpen((prev) => !prev)}
            >
              File
            </button>
            {isFileMenuOpen ? (
              <div className="top-bar-submenu" role="menu" aria-label="File menu">
                <button type="button" className="submenu-item" role="menuitem">
                  Open Folder
                </button>
              </div>
            ) : null}
          </div>
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
