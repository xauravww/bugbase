import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Loader } from "./Loader";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "outline"
  | "subtle";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  iconClassName?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent-active shadow-sm",
  secondary:
    "bg-surface text-fg border border-border hover:bg-bg-hover hover:border-border-strong",
  danger:
    "bg-danger text-danger-fg hover:opacity-90 active:opacity-80 shadow-sm",
  ghost:
    "bg-transparent text-fg-muted hover:bg-bg-hover hover:text-fg",
  outline:
    "bg-transparent text-fg border border-border-strong hover:bg-bg-hover",
  subtle:
    "bg-accent-subtle text-accent hover:bg-accent-subtle/70",
};

// Height/padding tuned for icon + text layouts. Icon-only mode swaps padding for square width.
const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-xs gap-1",
  sm: "h-8 px-2.5 text-sm gap-1.5",
  md: "h-9 px-3.5 text-sm gap-1.5",
  lg: "h-10 px-5 text-base gap-2",
};

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 w-7 p-0",
  sm: "h-8 w-8 p-0",
  md: "h-9 w-9 p-0",
  lg: "h-10 w-10 p-0",
};

const iconSizeClasses: Record<ButtonSize, string> = {
  xs: "w-3.5 h-3.5",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-4 h-4",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      iconClassName,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isIconOnly = !children && (LeftIcon || RightIcon);
    const iconCls = cn(iconSizeClasses[size], iconClassName);

    let leftContent: ReactNode = null;
    if (loading) {
      leftContent = <Loader size="sm" className={cn(iconCls, "border-current border-t-transparent")} />;
    } else if (LeftIcon) {
      leftContent = <LeftIcon className={iconCls} aria-hidden />;
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // base
          "inline-flex items-center justify-center font-medium rounded-md cursor-pointer whitespace-nowrap",
          "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
          "disabled:opacity-50 disabled:pointer-events-none",
          // variant
          variantClasses[variant],
          // size
          isIconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
          className
        )}
        {...props}
      >
        {leftContent}
        {children}
        {RightIcon && !loading && <RightIcon className={iconCls} aria-hidden />}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
