import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
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
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      rightSlot,
      id,
      ...props
    },
    ref
  ) => {
    const showRightSlot = rightSlot ?? (RightIcon ? <RightIcon className="w-4 h-4 text-fg-muted" aria-hidden /> : null);

    return (
      <div className={cn("w-full", wrapperClassName)}>
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-fg mb-1.5"
          >
            {label}
          </label>
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
              "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-subtle",
              LeftIcon && "pl-9",
              showRightSlot && "pr-9",
              error && "border-danger focus:border-danger focus:ring-danger/30",
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
