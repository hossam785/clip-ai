import * as React from "react";
import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8 bg-zinc-950/20 border border-zinc-800/60 border-dashed rounded-xl", className)}>
      {icon && <div className="mb-4 text-zinc-500">{icon}</div>}
      <h3 className="text-base font-bold text-zinc-200 mb-1.5">{title}</h3>
      <p className="text-sm text-zinc-400 max-w-sm mb-5 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
