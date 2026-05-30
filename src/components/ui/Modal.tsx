"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  showHeaderDivider?: boolean;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-[95vw] max-h-[95vh]",
};

const EXIT_DURATION = 180;

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "lg",
  closeOnBackdrop = true,
  showHeaderDivider = true,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => setMounted(true), []);

  // Drive mount/unmount with an exit animation.
  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      setVisible(true);
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, EXIT_DURATION);
      return () => clearTimeout(t);
    }
  }, [isOpen, visible]);

  useEffect(() => {
    if (!visible) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Focus trap — keep Tab inside the panel.
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleTab);
    document.body.style.overflow = "hidden";

    // Initial focus.
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleTab);
      document.body.style.overflow = "";
    };
  }, [visible, onClose]);

  if (!visible || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm",
          closing ? "animate-out-fade" : "animate-in-fade"
        )}
        onClick={() => closeOnBackdrop && onClose()}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative bg-surface border border-border rounded-xl shadow-lg w-full",
          "flex flex-col max-h-[90vh] overflow-hidden",
          "focus:outline-none",
          sizeClasses[size],
          closing ? "animate-out-scale" : "animate-in-scale",
          className
        )}
      >
        {(title || description) && (
          <div
            className={cn(
              "flex items-start justify-between gap-4 px-5 py-4",
              showHeaderDivider && "border-b border-border"
            )}
          >
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-semibold text-fg leading-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-fg-muted">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                "inline-flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0",
                "text-fg-muted hover:text-fg hover:bg-bg-hover",
                "transition-colors duration-[var(--duration-fast)]"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="px-5 py-3 border-t border-border bg-bg-elevated rounded-b-xl flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
