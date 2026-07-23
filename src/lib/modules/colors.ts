/**
 * Status / priority / severity → badge styling. Token-driven where possible,
 * falls back to inline hex for the PM-specific enum values the base app
 * doesn't know about. Client-safe.
 */
export function enumColor(value: string | null | undefined): { color: string; bg: string } {
  if (!value) return { color: "#787774", bg: "#e4e4e2" };
  const v = value.toLowerCase();

  // greens (done / released / stable / approved / closed-good)
  if (["done", "released", "stable", "approved", "completed", "resolved", "verified"].includes(v))
    return { color: "#1a7f4b", bg: "#e6f4ec" };
  // blues (in progress / active / planned)
  if (["in progress", "active", "mitigating", "under review", "planned"].includes(v))
    return { color: "#2e75cc", bg: "#e8f0fb" };
  // purple (review / testing / proposed / draft)
  if (["review", "testing", "in review", "proposed", "draft", "upcoming", "new"].includes(v))
    return { color: "#7b5ea7", bg: "#f3eff9" };
  // orange (todo / open / high / medium)
  if (["todo", "open", "high", "medium", "staging"].includes(v))
    return { color: "#d9730d", bg: "#fef3e7" };
  // red (critical / blocked / missed / rolled back / production)
  if (["critical", "blocked", "missed", "rolled back", "won't fix", "rejected", "deprecated"].includes(v))
    return { color: "#c0392b", bg: "#fde8e8" };
  // low / neutral
  if (["low", "none", "cancelled", "accepted"].includes(v))
    return { color: "#2e75cc", bg: "#e8f4fd" };

  return { color: "#787774", bg: "#e4e4e2" };
}

/** Risk heat: impact × probability → cell color. */
export function riskColor(impact: string, probability: string): string {
  const w = (x: string) => (x === "High" ? 3 : x === "Medium" ? 2 : 1);
  const score = w(impact) * w(probability);
  if (score >= 6) return "#c0392b";
  if (score >= 3) return "#d9730d";
  return "#1a7f4b";
}
