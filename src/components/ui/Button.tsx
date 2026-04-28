import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5b76fe] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed touch-target",
          {
            // Variants - Miro-inspired
            "bg-[#5b76fe] text-white hover:bg-[#2a41b6]": variant === "primary",
            "bg-white text-[#1c1c1e] border hover:bg-[#f5f5f5]": variant === "secondary",
            "bg-[#eb5757] text-white hover:bg-[#c0392b]": variant === "danger",
            "bg-transparent text-[#555a6a] hover:bg-[#f5f5f5]": variant === "ghost",
            // Sizes
            "text-xs px-2.5 py-1.5": size === "sm",
            "text-sm px-4 py-2": size === "md",
            "text-base px-6 py-2.5": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
