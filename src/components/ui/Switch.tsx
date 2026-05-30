"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: "sm" | "md";
}

const sizes = {
  sm: { track: "w-7 h-4", thumb: "w-3 h-3", translate: "translate-x-3" },
  md: { track: "w-9 h-5", thumb: "w-4 h-4", translate: "translate-x-4" },
} as const;

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, size = "md", disabled, ...props }, ref) => {
    const sz = sizes[size];
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "relative inline-flex items-center rounded-full flex-shrink-0",
          "transition-colors duration-[var(--duration-fast)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          checked ? "bg-accent" : "bg-border-strong",
          sz.track,
          className
        )}
        {...props}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block rounded-full bg-bg shadow-sm",
            "transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]",
            sz.thumb,
            checked ? sz.translate : "translate-x-0.5"
          )}
        />
      </button>
    );
  }
);
Switch.displayName = "Switch";
