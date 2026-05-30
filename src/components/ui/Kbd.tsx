import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

interface KbdProps {
  children: ReactNode;
  className?: string;
}

/**
 * Inline keyboard-shortcut chip. Pairs nicely with command bars and menu items.
 */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center font-mono",
        "text-[11px] leading-none px-1.5 py-0.5",
        "rounded border border-border bg-bg-subtle text-fg-muted",
        "shadow-[inset_0_-1px_0_var(--border)]",
        className
      )}
    >
      {children}
    </kbd>
  );
}
