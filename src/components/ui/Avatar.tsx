"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  name: string;
  /** Optional image URL — falls back to colored initials on load error. */
  image?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Map hash -> avatar palette slot (1..8). */
function getAvatarSlot(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (Math.abs(hash) % 8) + 1;
}

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "w-5 h-5 text-[10px]",
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
  xl: "w-14 h-14 text-lg",
};

const AVATAR_COLORS = [
  "#5b76fe", // 1
  "#00b473", // 2
  "#d9730d", // 3
  "#337ea9", // 4
  "#e5484d", // 5
  "#7b5ea7", // 6
  "#cb912f", // 7
  "#448361", // 8
];

export function Avatar({ name, image, size = "md", className }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const initials = getInitials(name);
  const slot = getAvatarSlot(name);
  const bgColor = AVATAR_COLORS[slot - 1];

  const showImage = image && !errored;

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium flex-shrink-0 overflow-hidden select-none",
        sizeClasses[size],
        className
      )}
      style={!showImage ? { backgroundColor: bgColor, color: "#ffffff" } : undefined}
      title={name}
      aria-label={name}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

interface AvatarGroupProps {
  names: string[];
  max?: number;
  size?: AvatarProps["size"];
  className?: string;
}

export function AvatarGroup({ names, max = 3, size = "sm", className }: AvatarGroupProps) {
  const visible = names.slice(0, max);
  const remaining = names.length - max;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visible.map((name, i) => (
        <Avatar
          key={`${name}-${i}`}
          name={name}
          size={size}
          className="ring-2 ring-bg"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full font-medium ring-2 ring-bg",
            "bg-bg-subtle text-fg-muted",
            sizeClasses[size ?? "sm"]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
