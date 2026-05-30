import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

export type BadgeVariant =
  // Generic semantic
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "danger"
  // App-specific status
  | "open"
  | "in-progress"
  | "in-review"
  | "verified"
  | "closed"
  // App-specific type
  | "bug"
  | "feature";

export type BadgeStyle = "subtle" | "solid" | "outline";
export type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: BadgeStyle;
  size?: BadgeSize;
  className?: string;
}

// Background/foreground pairs per variant. Tokens used here resolve via Tailwind
// utilities (bg-*, text-*) backed by globals.css.
const subtleClasses: Record<BadgeVariant, string> = {
  neutral: "bg-bg-subtle text-fg-muted",
  brand: "bg-accent-subtle text-accent",
  info: "bg-info-bg text-info",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  open: "bg-[var(--status-open-bg)] text-[var(--status-open-fg)]",
  "in-progress": "bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]",
  "in-review": "bg-[var(--status-review-bg)] text-[var(--status-review-fg)]",
  verified: "bg-[var(--status-verified-bg)] text-[var(--status-verified-fg)]",
  closed: "bg-[var(--status-closed-bg)] text-[var(--status-closed-fg)]",
  bug: "bg-[var(--type-bug-bg)] text-[var(--type-bug-fg)]",
  feature: "bg-[var(--type-feature-bg)] text-[var(--type-feature-fg)]",
};

const solidClasses: Record<BadgeVariant, string> = {
  neutral: "bg-fg-muted text-bg",
  brand: "bg-accent text-accent-fg",
  info: "bg-info text-info-fg",
  success: "bg-success text-success-fg",
  warning: "bg-warning text-warning-fg",
  danger: "bg-danger text-danger-fg",
  open: "bg-[var(--status-open-fg)] text-bg",
  "in-progress": "bg-[var(--status-progress-fg)] text-bg",
  "in-review": "bg-[var(--status-review-fg)] text-bg",
  verified: "bg-[var(--status-verified-fg)] text-bg",
  closed: "bg-[var(--status-closed-fg)] text-bg",
  bug: "bg-[var(--type-bug-fg)] text-bg",
  feature: "bg-[var(--type-feature-fg)] text-bg",
};

const outlineClasses: Record<BadgeVariant, string> = {
  neutral: "border border-border text-fg-muted",
  brand: "border border-accent text-accent",
  info: "border border-info text-info",
  success: "border border-success text-success",
  warning: "border border-warning text-warning",
  danger: "border border-danger text-danger",
  open: "border border-[var(--status-open-fg)] text-[var(--status-open-fg)]",
  "in-progress": "border border-[var(--status-progress-fg)] text-[var(--status-progress-fg)]",
  "in-review": "border border-[var(--status-review-fg)] text-[var(--status-review-fg)]",
  verified: "border border-[var(--status-verified-fg)] text-[var(--status-verified-fg)]",
  closed: "border border-[var(--status-closed-fg)] text-[var(--status-closed-fg)]",
  bug: "border border-[var(--type-bug-fg)] text-[var(--type-bug-fg)]",
  feature: "border border-[var(--type-feature-fg)] text-[var(--type-feature-fg)]",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
};

export function Badge({
  children,
  variant = "neutral",
  style = "subtle",
  size = "md",
  className,
}: BadgeProps) {
  const styleMap =
    style === "solid" ? solidClasses : style === "outline" ? outlineClasses : subtleClasses;

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md whitespace-nowrap",
        styleMap[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

// ----- App-specific convenience wrappers (back-compat API) -----

export function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    Open: "open",
    "In Progress": "in-progress",
    "In Review": "in-review",
    Verified: "verified",
    Closed: "closed",
  };
  return <Badge variant={variantMap[status] ?? "neutral"}>{status}</Badge>;
}

export function TypeBadge({ type }: { type: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    Bug: "bug",
    Feature: "feature",
  };
  return <Badge variant={variantMap[type] ?? "neutral"}>{type}</Badge>;
}

interface PriorityProps {
  priority: string;
}

const priorityClasses: Record<string, string> = {
  Low: "bg-[var(--priority-low)]",
  Medium: "bg-[var(--priority-medium)]",
  High: "bg-[var(--priority-high)]",
  Critical: "bg-[var(--priority-critical)]",
};

export function PriorityDot({ priority }: PriorityProps) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full",
        priorityClasses[priority] ?? "bg-fg-subtle"
      )}
      title={priority}
      aria-label={`Priority ${priority}`}
    />
  );
}

export function PriorityBadge({ priority }: PriorityProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
      <PriorityDot priority={priority} />
      {priority}
    </span>
  );
}
