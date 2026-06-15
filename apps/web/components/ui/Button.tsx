import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "brand";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-brand/50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
          // Variants
          variant === "primary" && "bg-primary-brand text-white hover:bg-primary-brand-hover shadow-lg shadow-primary-brand/20",
          variant === "brand" && "bg-gradient-to-r from-primary-brand to-purple-650 text-white hover:opacity-95 shadow-md",
          variant === "secondary" && "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700/50",
          variant === "outline" && "bg-transparent text-zinc-300 hover:text-white border border-zinc-700 hover:bg-zinc-800/50",
          variant === "ghost" && "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-850",
          variant === "danger" && "bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20",
          // Sizes
          size === "sm" && "px-3 py-1.5 text-xs",
          size === "md" && "px-4 py-2 text-sm",
          size === "lg" && "px-5 py-2.5 text-base",
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
