import * as React from "react";
import { cn } from "../../lib/utils";

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = "top", className }) => {
  return (
    <div className="group relative inline-block">
      {children}
      <div
        className={cn(
          "absolute hidden group-hover:block bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded px-2.5 py-1.5 shadow-xl z-40 whitespace-nowrap pointer-events-none transition-all duration-200 animate-fade-in glass-panel",
          // Positions
          position === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-2",
          position === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-2",
          position === "left" && "right-full top-1/2 -translate-y-1/2 mr-2",
          position === "right" && "left-full top-1/2 -translate-y-1/2 ml-2",
          className
        )}
      >
        {content}
      </div>
    </div>
  );
};
