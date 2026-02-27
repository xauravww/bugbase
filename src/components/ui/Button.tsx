import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors duration-150 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          {
            // Variants
            "bg-[var(--color-text-primary)] text-white hover:bg-[#333333]": variant === "primary",
            "bg-white text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-hover-bg)]": variant === "secondary",
            "bg-[var(--color-danger)] text-white hover:bg-[#c0392b]": variant === "danger",
            "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-hover-bg)]": variant === "ghost",
            // Sizes
            "text-xs px-2.5 py-1.5": size === "sm",
            "text-sm px-4 py-2": size === "md",
            "text-base px-6 py-2.5": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
