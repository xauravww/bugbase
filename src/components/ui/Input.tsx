import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md transition-colors duration-150",
            "placeholder:text-[var(--color-text-placeholder)]",
            "focus:outline-none focus:border-[var(--color-accent)]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-surface)]",
            error && "border-[var(--color-danger)] focus:border-[var(--color-danger)]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
