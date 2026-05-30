import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  label?: ReactNode;
  className?: string;
}

export function Divider({ orientation = "horizontal", label, className }: DividerProps) {
  if (orientation === "vertical") {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn("inline-block w-px self-stretch bg-border", className)}
      />
    );
  }
  if (label) {
    return (
      <div
        role="separator"
        className={cn("flex items-center gap-3 my-2", className)}
      >
        <span className="flex-1 h-px bg-border" />
        <span className="text-xs uppercase tracking-wider text-fg-subtle font-medium">
          {label}
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>
    );
  }
  return (
    <hr role="separator" className={cn("border-0 h-px bg-border w-full", className)} />
  );
}
