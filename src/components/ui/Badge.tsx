import { cn } from "@/lib/utils/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "open" | "in-progress" | "in-review" | "verified" | "closed" | "bug" | "feature";
  className?: string;
}

const variantStyles = {
  default: "bg-[var(--color-tag-bg)] text-[var(--color-text-primary)]",
  open: "bg-[var(--color-status-open-bg)] text-[var(--color-status-open-text)]",
  "in-progress": "bg-[var(--color-status-progress-bg)] text-[var(--color-status-progress-text)]",
  "in-review": "bg-[var(--color-status-review-bg)] text-[var(--color-status-review-text)]",
  verified: "bg-[var(--color-status-verified-bg)] text-[var(--color-status-verified-text)]",
  closed: "bg-[var(--color-status-closed-bg)] text-[var(--color-status-closed-text)]",
  bug: "bg-[var(--color-type-bug-bg)] text-[var(--color-type-bug-text)]",
  feature: "bg-[var(--color-type-feature-bg)] text-[var(--color-type-feature-text)]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeProps["variant"]> = {
    "Open": "open",
    "In Progress": "in-progress",
    "In Review": "in-review",
    "Verified": "verified",
    "Closed": "closed",
  };
  
  return <Badge variant={variantMap[status] || "default"}>{status}</Badge>;
}

export function TypeBadge({ type }: { type: string }) {
  const variantMap: Record<string, BadgeProps["variant"]> = {
    "Bug": "bug",
    "Feature": "feature",
  };
  
  return <Badge variant={variantMap[type] || "default"}>{type}</Badge>;
}

interface PriorityBadgeProps {
  priority: string;
}

const priorityColors: Record<string, string> = {
  "Low": "bg-[var(--color-priority-low)]",
  "Medium": "bg-[var(--color-priority-medium)]",
  "High": "bg-[var(--color-priority-high)]",
  "Critical": "bg-[var(--color-priority-critical)]",
};

export function PriorityDot({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full",
        priorityColors[priority] || "bg-gray-400"
      )}
      title={priority}
    />
  );
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
      <PriorityDot priority={priority} />
      {priority}
    </span>
  );
}
