import React, { useEffect, useRef } from 'react';
import { XIcon, Reply } from 'lucide-react';

interface MessageContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number } | null;
  actions: MessageContextMenuAction[];
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  isOpen,
  onClose,
  position,
  actions
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add delay to prevent immediate close on touch end
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  // Calculate position to avoid viewport overflow
  const menuWidth = 120;
  const menuHeight = 50 * actions.length;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let x = position.x;
  let y = position.y;

  // Adjust horizontal position
  if (x + menuWidth > viewportWidth) {
    x = viewportWidth - menuWidth - 10;
  }
  if (x < 10) {
    x = 10;
  }

  // Adjust vertical position
  if (y + menuHeight > viewportHeight) {
    y = viewportHeight - menuHeight - 10;
  }
  if (y < 10) {
    y = 10;
  }

  return (
    <>
      {/* Backdrop for better visibility */}
      <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" onClick={onClose} />
      
      {/* Context Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          minWidth: '120px'
        }}
      >
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={`w-full px-4 py-3 flex items-center gap-2 text-left transition-colors ${
              action.variant === 'destructive'
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-foreground hover:bg-accent'
            } ${index !== 0 ? 'border-t border-border' : ''}`}
          >
            {action.icon && <span className="w-4 h-4">{action.icon}</span>}
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </>
  );
};
