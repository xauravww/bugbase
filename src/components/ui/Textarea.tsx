"use client";

import { forwardRef, useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { FieldHelpButton } from "./FieldHelp";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  help?: {
    whatItIs?: string;
    example?: string;
    template?: string;
    tip?: string;
  };
  /** Grow with content. */
  autoResize?: boolean;
  wrapperClassName?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, wrapperClassName, label, error, hint, help, autoResize, id, value, defaultValue, onChange, ...props }, ref) => {
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
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor={id} className="block text-sm font-medium text-fg min-w-0">
              {label}
            </label>
            <FieldHelpButton
              label={label}
              kind="textarea"
              placeholder={typeof props.placeholder === "string" ? props.placeholder : undefined}
              content={help}
            />
          </div>
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
