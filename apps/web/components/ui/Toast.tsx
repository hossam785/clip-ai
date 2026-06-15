"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (type: ToastType, message: string, description?: string, duration?: number) => void;
  success: (message: string, description?: string, duration?: number) => void;
  error: (message: string, description?: string, duration?: number) => void;
  info: (message: string, description?: string, duration?: number) => void;
  warning: (message: string, description?: string, duration?: number) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (type: ToastType, message: string, description?: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, message, description, duration }]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const success = React.useCallback((message: string, description?: string, duration?: number) => {
    toast("success", message, description, duration);
  }, [toast]);

  const error = React.useCallback((message: string, description?: string, duration?: number) => {
    toast("error", message, description, duration);
  }, [toast]);

  const info = React.useCallback((message: string, description?: string, duration?: number) => {
    toast("info", message, description, duration);
  }, [toast]);

  const warning = React.useCallback((message: string, description?: string, duration?: number) => {
    toast("warning", message, description, duration);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex gap-3 p-4 bg-zinc-950 border rounded-xl shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-in-right glass-panel",
              t.type === "success" && "border-green-500/30 text-green-400",
              t.type === "error" && "border-red-500/30 text-red-400",
              t.type === "info" && "border-blue-500/30 text-blue-400",
              t.type === "warning" && "border-yellow-500/30 text-yellow-400"
            )}
          >
            <div className="mt-0.5 flex-shrink-0">
              {t.type === "success" && <CheckCircle2 className="h-5 w-5" />}
              {t.type === "error" && <AlertCircle className="h-5 w-5" />}
              {t.type === "info" && <Info className="h-5 w-5" />}
              {t.type === "warning" && <AlertCircle className="h-5 w-5" />}
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-zinc-100">{t.message}</span>
              {t.description && <span className="text-xs text-zinc-400">{t.description}</span>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 self-start hover:bg-zinc-900/50 rounded flex-shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
