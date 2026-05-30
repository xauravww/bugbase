import { cn } from "@/lib/utils/cn";
import { RefreshCw, type LucideIcon } from "lucide-react";

interface FabButtonProps {
  icon: LucideIcon;
  label: string;
  labelMobile?: string;
  onClick: () => void;
  isLoading?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}

const variantClasses = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-active shadow-md hover:shadow-lg hover:-translate-y-px",
  secondary:
    "bg-surface text-fg border border-border hover:bg-bg-hover hover:border-border-strong shadow-sm hover:shadow-md",
};

export function FabButton({
  icon: Icon,
  label,
  labelMobile,
  onClick,
  isLoading,
  variant = "primary",
  className,
}: FabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap cursor-pointer",
        "transition-all duration-[var(--duration-base)] ease-[var(--ease-out)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-70 disabled:cursor-not-allowed",
        variantClasses[variant],
        className
      )}
    >
      {isLoading ? (
        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
      ) : (
        <Icon className="w-4 h-4" aria-hidden />
      )}
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden">{labelMobile || label}</span>
    </button>
  );
}
