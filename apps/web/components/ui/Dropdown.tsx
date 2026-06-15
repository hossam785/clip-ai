"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = "right" }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            "absolute mt-2 w-52 rounded-lg bg-zinc-950 border border-zinc-800 shadow-xl z-30 py-1 overflow-hidden animate-fade-in glass-panel",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-900/60 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-colors",
                item.className
              )}
            >
              {item.icon && <span className="text-zinc-400">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
