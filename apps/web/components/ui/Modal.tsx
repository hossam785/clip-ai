"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}) => {
  // Listen for escape key press to close modal
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={cn(
          "relative w-full max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800/80 rounded-xl shadow-2xl z-10 overflow-hidden transform transition-all duration-300 animate-slide-up glass-panel",
          size === "sm" && "max-w-md",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-2xl",
          size === "xl" && "max-w-4xl",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
          {title ? (
            <h3 className="text-base font-bold text-zinc-100">{title}</h3>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-zinc-300">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800/50 bg-zinc-900/20">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
