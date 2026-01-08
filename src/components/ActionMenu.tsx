import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icons";

type ActionMenuItem = {
  id: string;
  icon?: string;
  label: string;
  disabled?: boolean;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  position: { x: number; y: number };
  onSelect: (itemId: string) => void;
  onClose: () => void;
};

export function ActionMenu({ items, position, onClose, onSelect }: ActionMenuProps) {
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
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="action-menu"
      role="menu"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="action-menu-item"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            onSelect(item.id);
          }}
        >
          {item.icon ? <Icon name={item.icon as any} size={14} className="action-menu-icon" /> : null}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
