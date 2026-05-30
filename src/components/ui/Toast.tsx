"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastOptions {
  description?: ReactNode;
  /** Auto-dismiss delay in ms. 0 disables auto-dismiss. */
  duration?: number;
  id?: string;
}

interface ToastRecord {
  id: string;
  variant: ToastVariant;
  message: ReactNode;
  description?: ReactNode;
  duration: number;
  /** Internal: true once mounted, used for exit animation. */
  exiting?: boolean;
}

interface ToastApi {
  success: (message: ReactNode, opts?: ToastOptions) => string;
  error: (message: ReactNode, opts?: ToastOptions) => string;
  info: (message: ReactNode, opts?: ToastOptions) => string;
  warning: (message: ReactNode, opts?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 4000;
const EXIT_DURATION = 180;

const variantConfig: Record<ToastVariant, { icon: typeof CheckCircle2; color: string }> = {
  success: { icon: CheckCircle2, color: "text-success" },
  error: { icon: AlertCircle, color: "text-danger" },
  info: { icon: Info, color: "text-info" },
  warning: { icon: AlertTriangle, color: "text-warning" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [mounted, setMounted] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    // remove after exit animation
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, EXIT_DURATION);
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: ReactNode, opts: ToastOptions = {}) => {
      const id = opts.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = opts.duration ?? DEFAULT_DURATION;
      const record: ToastRecord = {
        id,
        variant,
        message,
        description: opts.description,
        duration,
      };
      setToasts((list) => [...list, record]);
      if (duration > 0) {
        const t = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, t);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push("success", m, o),
      error: (m, o) => push("error", m, o),
      info: (m, o) => push("info", m, o),
      warning: (m, o) => push("warning", m, o),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none"
            aria-live="polite"
            aria-atomic="false"
          >
            {toasts.map((t) => {
              const Cfg = variantConfig[t.variant];
              const Icon = Cfg.icon;
              return (
                <div
                  key={t.id}
                  role="status"
                  className={cn(
                    "pointer-events-auto",
                    "min-w-[280px] max-w-sm",
                    "bg-surface border border-border rounded-lg shadow-popover",
                    "p-3 flex items-start gap-2.5",
                    t.exiting ? "animate-out-slide-right" : "animate-in-slide-right"
                  )}
                >
                  <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", Cfg.color)} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-fg">{t.message}</div>
                    {t.description && (
                      <div className="mt-0.5 text-xs text-fg-muted">{t.description}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss"
                    className={cn(
                      "flex-shrink-0 w-5 h-5 inline-flex items-center justify-center rounded",
                      "text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors"
                    )}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
