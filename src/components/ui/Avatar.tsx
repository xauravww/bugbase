import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = [
    "#2e75cc", "#d9730d", "#7b5ea7", "#1f8a4c",
    "#eb5757", "#337ea9", "#cb912f", "#448361",
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = getColorFromName(name);
  
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-medium",
        {
          "w-6 h-6 text-xs": size === "sm",
          "w-8 h-8 text-sm": size === "md",
          "w-10 h-10 text-base": size === "lg",
        },
        className
      )}
      style={{ backgroundColor: bgColor }}
      title={name}
    >
      {initials}
    </div>
  );
}

interface AvatarGroupProps {
  names: string[];
  max?: number;
  size?: "sm" | "md" | "lg";
}

export function AvatarGroup({ names, max = 3, size = "sm" }: AvatarGroupProps) {
  const visible = names.slice(0, max);
  const remaining = names.length - max;
  
  return (
    <div className="flex -space-x-2">
      {visible.map((name, i) => (
        <Avatar
          key={i}
          name={name}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-[var(--color-tag-bg)] text-[var(--color-text-secondary)] font-medium ring-2 ring-white",
            {
              "w-6 h-6 text-xs": size === "sm",
              "w-8 h-8 text-sm": size === "md",
              "w-10 h-10 text-base": size === "lg",
            }
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
