"use client";

import { forwardRef, useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Grow with content. */
  autoResize?: boolean;
  wrapperClassName?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, wrapperClassName, label, error, hint, autoResize, id, value, defaultValue, onChange, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const resize = () => {
      const el = innerRef.current;
      if (!el || !autoResize) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    useEffect(() => {
      if (autoResize) resize();
    }, [value, autoResize]);

    return (
      <div className={cn("w-full", wrapperClassName)}>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-fg mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={(el) => {
            innerRef.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
          }}
          id={id}
          value={value}
          defaultValue={defaultValue}
          onChange={(e) => {
            onChange?.(e);
            resize();
          }}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full min-h-[80px] px-3 py-2 text-sm rounded-md resize-y",
            "bg-surface border border-border text-fg placeholder:text-fg-placeholder",
            "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
            "hover:border-border-strong",
            "focus:outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-subtle",
            autoResize && "overflow-hidden resize-none",
            error && "border-danger",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="mt-1 text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-xs text-fg-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
