import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import type { TreeNodeContextMenuItem } from "../types/tree";

type ContextMenuProps = {
  items: TreeNodeContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  onSelect?: (itemId: string) => void;
};

export function ContextMenu({ items, position, onClose, onSelect }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const padding = 8;
    let nextX = position.x;
    let nextY = position.y;

    if (nextX + rect.width > window.innerWidth - padding) {
      nextX = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (nextY + rect.height > window.innerHeight - padding) {
      nextY = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    setAdjustedPosition({ x: nextX, y: nextY });
  }, [items.length, position.x, position.y]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("contextmenu", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("contextmenu", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => {
        if (item.type === "separator") {
          return (
            <div key={item.id} className="context-menu-separator" role="separator">
              <span>{item.label}</span>
            </div>
          );
        }

        if (item.type === "radio") {
          return (
            <button
              key={item.id}
              type="button"
              className={`context-menu-item context-menu-item-radio ${
                item.selected ? "is-selected" : ""
              }`}
              role="menuitemradio"
              aria-checked={item.selected ?? false}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                onSelect?.(item.id);
                onClose();
              }}
            >
              <span className="context-menu-check">
                {item.selected ? (
                  <Icon name="check" size={12} className="context-menu-check-icon" />
                ) : null}
              </span>
              <span>{item.label}</span>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            className="context-menu-item"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              onSelect?.(item.id);
              onClose();
            }}
          >
            {item.icon ? <Icon name={item.icon} size={14} className="context-menu-icon" /> : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
