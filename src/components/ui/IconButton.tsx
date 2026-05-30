import { forwardRef, type ButtonHTMLAttributes } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Tooltip } from "./Tooltip";

export type IconButtonVariant = "ghost" | "subtle" | "outline" | "primary" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Accessible label. Also used as tooltip text when `tooltip` is true. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Wrap with a Tooltip showing `label`. */
  tooltip?: boolean;
  iconClassName?: string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  ghost: "bg-transparent text-fg-muted hover:bg-bg-hover hover:text-fg",
  subtle: "bg-bg-subtle text-fg hover:bg-bg-hover",
  outline: "border border-border text-fg hover:bg-bg-hover hover:border-border-strong",
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  danger: "bg-transparent text-danger hover:bg-danger-bg",
};

const sizeClasses: Record<IconButtonSize, { box: string; icon: string }> = {
  sm: { box: "w-7 h-7", icon: "w-3.5 h-3.5" },
  md: { box: "w-8 h-8", icon: "w-4 h-4" },
  lg: { box: "w-10 h-10", icon: "w-5 h-5" },
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      icon: Icon,
      label,
      variant = "ghost",
      size = "md",
      tooltip = false,
      iconClassName,
      ...props
    },
    ref
  ) => {
    const sz = sizeClasses[size];
    const button = (
      <button
        ref={ref}
        type={props.type ?? "button"}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center rounded-md flex-shrink-0 cursor-pointer",
          "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
          "disabled:opacity-50 disabled:pointer-events-none",
          variantClasses[variant],
          sz.box,
          className
        )}
        {...props}
      >
        <Icon className={cn(sz.icon, iconClassName)} aria-hidden />
      </button>
    );

    if (!tooltip) return button;
    return <Tooltip content={label}>{button}</Tooltip>;
  }
);

IconButton.displayName = "IconButton";

export { IconButton };
