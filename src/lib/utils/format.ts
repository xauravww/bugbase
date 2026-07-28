const UNITS = [
  { limit: 1_000_000_000_000, suffix: "T" },
  { limit: 1_000_000_000, suffix: "B" },
  { limit: 1_000_000, suffix: "M" },
  { limit: 1_000, suffix: "K" },
] as const;

/**
 * Compact number for tight UI like count badges: 999 → "999", 1500 → "1.5K",
 * 2_400_000 → "2.4M".
 *
 * Rounding is applied before picking the unit, so a value that rounds up past
 * its own unit carries to the next one (999_999 → "1M", never "1000K").
 * Non-finite input renders as "0" so a badge never shows "NaN"; negatives keep
 * their sign.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  for (const { limit, suffix } of UNITS) {
    if (abs < limit) continue;
    // One decimal, but drop it when it rounds to a whole unit ("1.0K" → "1K").
    const scaled = Math.round((abs / limit) * 10) / 10;
    // Rounding can push the value up into the next unit (999_999 → 1000K),
    // so hand it back to the loop's larger unit by re-formatting.
    if (scaled >= 1000) return formatNumber(value < 0 ? -limit * 1000 : limit * 1000);
    return `${sign}${scaled}${suffix}`;
  }

  return `${sign}${Math.round(abs)}`;
}
