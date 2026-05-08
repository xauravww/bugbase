export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; color: string }> = [
  { name: "Homepage", color: "#6366f1" },
  { name: "Navigation", color: "#8b5cf6" },
  { name: "Sidebar", color: "#ec4899" },
  { name: "Header", color: "#14b8a6" },
  { name: "Footer", color: "#f59e0b" },
  { name: "Cards", color: "#3b82f6" },
  { name: "Buttons", color: "#10b981" },
  { name: "Forms", color: "#ef4444" },
  { name: "Modals", color: "#06b6d4" },
  { name: "Dropdowns", color: "#84cc16" },
  { name: "Tooltips", color: "#a855f7" },
  { name: "Tables", color: "#f97316" },
  { name: "Authentication", color: "#eab308" },
  { name: "Search", color: "#64748b" },
  { name: "Dashboard", color: "#0ea5e9" },
  { name: "Settings", color: "#78716c" },
  { name: "Responsive", color: "#22c55e" },
  { name: "Performance", color: "#e11d48" },
  { name: "API/Backend", color: "#6366f1" },
  { name: "Database", color: "#0f172a" },
];

export function contrastingText(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}
