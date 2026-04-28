import { cn } from "@/lib/utils/cn";
import { RefreshCw, type LucideIcon } from "lucide-react";

interface FabButtonProps {
  icon: LucideIcon;
  label: string;
  labelMobile?: string;
  onClick: () => void;
  isLoading?: boolean;
  className?: string;
}

export function FabButton({ icon: Icon, label, labelMobile, onClick, isLoading, className }: FabButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed",
        className
      )}
      style={{ 
        background: "#5b76fe", 
        color: "#ffffff", 
        fontFamily: "DM Sans, sans-serif" 
      }}
      onMouseEnter={(e) => {
        if (!isLoading) {
          e.currentTarget.style.background = "#4a63d8";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isLoading) {
          e.currentTarget.style.background = "#5b76fe";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
    >
      {isLoading ? (
        <RefreshCw className="w-4 h-4" style={{ animation: "spin 1s linear infinite" }} />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden">{labelMobile || label}</span>
    </button>
  );
}