import * as React from "react";
import { cn } from "../../lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div className={cn("flex border-b border-zinc-800/80 overflow-x-auto", className)}>
      <nav className="-mb-px flex space-x-6 whitespace-nowrap" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "group relative flex items-center gap-2 py-4 px-1 text-sm font-semibold border-b-2 border-transparent transition-all duration-200 cursor-pointer",
                isActive
                  ? "text-primary-brand border-primary-brand"
                  : "text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              )}
            >
              {tab.icon && <span className={cn("transition-colors", isActive ? "text-primary-brand" : "text-zinc-500 group-hover:text-zinc-300")}>{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
