"use client";

import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "onChange" | "checked"> {
  checked: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  size?: "sm" | "md";
}

const sizeClasses = {
  sm: { box: "w-3.5 h-3.5", icon: "w-2.5 h-2.5" },
  md: { box: "w-4 h-4", icon: "w-3 h-3" },
} as const;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, label, size = "md", disabled, id, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement>(null);
    const indeterminate = checked === "indeterminate";

    useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    const sz = sizeClasses[size];
    const isChecked = checked === true;

    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex items-center gap-2 cursor-pointer select-none",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span className="relative inline-flex items-center justify-center">
          <input
            ref={(el) => {
              innerRef.current = el;
              if (typeof ref === "function") ref(el);
              else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
            }}
            id={id}
            type="checkbox"
            checked={isChecked}
            disabled={disabled}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            className="peer sr-only"
            {...props}
          />
          <span
            aria-hidden
            className={cn(
              "inline-flex items-center justify-center rounded-[4px]",
              "border border-border bg-surface",
              "transition-colors duration-[var(--duration-fast)]",
              "peer-hover:border-border-strong",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-accent-ring",
              (isChecked || indeterminate) && "bg-accent border-accent",
              sz.box
            )}
          >
            {indeterminate ? (
              <Minus className={cn(sz.icon, "text-accent-fg")} strokeWidth={3} />
            ) : isChecked ? (
              <Check className={cn(sz.icon, "text-accent-fg")} strokeWidth={3} />
            ) : null}
          </span>
        </span>
        {label && <span className="text-sm text-fg">{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
