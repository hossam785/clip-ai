import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helperText, icon, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-zinc-500 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              "w-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2.5 outline-none transition-all duration-200 focus:border-primary-brand focus:ring-1 focus:ring-primary-brand/30 disabled:opacity-50 disabled:cursor-not-allowed",
              icon && "pl-9",
              error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <span className="text-xs text-red-400 mt-0.5">{error}</span>
        ) : helperText ? (
          <span className="text-xs text-zinc-500 mt-0.5">{helperText}</span>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
