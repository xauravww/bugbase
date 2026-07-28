"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { DatePicker } from "./DatePicker";
import { cn } from "@/lib/utils/cn";
import { FieldHelpButton, type FieldHelpContent, type FieldHelpKind } from "./FieldHelp";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Overrides for the ℹ help modal. Anything omitted falls back to generated copy. */
  help?: Partial<FieldHelpContent>;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  /** Custom right-side slot (e.g. a Kbd chip). Wins over rightIcon when both set. */
  rightSlot?: ReactNode;
  wrapperClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      wrapperClassName,
      label,
      error,
      hint,
      help,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      rightSlot,
      id,
      type,
      ...props
    },
    ref
  ) => {
    if (type === "date") {
      return (
        <DatePicker
          ref={ref}
          id={id}
          name={props.name}
          label={label}
          error={error}
          hint={hint}
          help={help}
          value={props.value as string | number | null}
          onChange={(val) => {
            if (props.onChange) {
              const event = {
                target: { value: val, id, name: props.name },
                currentTarget: { value: val, id, name: props.name },
              } as React.ChangeEvent<HTMLInputElement>;
              props.onChange(event);
            }
          }}
          disabled={props.disabled}
          className={className}
          wrapperClassName={wrapperClassName}
          placeholder={typeof props.placeholder === "string" ? props.placeholder : undefined}
          min={typeof props.min === "string" ? props.min : undefined}
          max={typeof props.max === "string" ? props.max : undefined}
        />
      );
    }

    const showRightSlot = rightSlot ?? (RightIcon ? <RightIcon className="w-4 h-4 text-fg-muted" aria-hidden /> : null);

    return (
      <div className={cn("w-full", wrapperClassName)}>
        {label && (
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label
              htmlFor={id}
              className="block text-sm font-medium text-fg min-w-0"
            >
              {label}
            </label>
            <FieldHelpButton
              label={label}
              kind={(type as FieldHelpKind | undefined) ?? "text"}
              placeholder={typeof props.placeholder === "string" ? props.placeholder : undefined}
              content={help}
            />
          </div>
        )}

        <div className="relative">
          {LeftIcon && (
            <LeftIcon
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted"
              aria-hidden
            />
          )}
          <input
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            className={cn(
              "w-full h-9 px-3 text-sm rounded-md",
              "bg-surface border border-border text-fg",
              "placeholder:text-fg-placeholder",
              "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              "hover:border-border-strong",
              "focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-subtle",
              LeftIcon && "pl-9",
              showRightSlot && "pr-9",
              error && "border-danger",
              className
            )}
            {...props}
          />
          {showRightSlot && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              {showRightSlot}
            </div>
          )}
        </div>

        {error ? (
          <p className="mt-1 text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-xs text-fg-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
