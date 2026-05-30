import { cn } from "@/lib/utils/cn";

export type SkeletonVariant = "rect" | "text" | "circle";

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  /** For circle: diameter in px. For others: optional explicit size via className. */
  size?: number;
}

export function Skeleton({ variant = "rect", className, size }: SkeletonProps) {
  const base = "bg-bg-subtle animate-pulse";
  if (variant === "circle") {
    return (
      <div
        className={cn(base, "rounded-full", className)}
        style={size ? { width: size, height: size } : undefined}
      />
    );
  }
  if (variant === "text") {
    return <div className={cn(base, "rounded h-3 w-full", className)} />;
  }
  return <div className={cn(base, "rounded-md h-6 w-full", className)} />;
}
