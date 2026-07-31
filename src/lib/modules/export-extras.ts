/**
 * Client-safe metadata for the two exportable areas that live outside the PM
 * workspace registry: the project's Issues tab and its Tasks (lists) tab.
 *
 * Kept separate from meta.ts so the workspace sidebar keeps showing exactly
 * the 19 PM modules, while the export picker can offer these as extras.
 * NO server imports — the export modal consumes this directly.
 */
export const EXTRA_SLUGS = ["issues", "tasks"] as const;
export type ExtraSlug = (typeof EXTRA_SLUGS)[number];

export interface ExtraMeta {
  slug: ExtraSlug;
  label: string;
  singular: string;
  icon: string;
  /** Shown in the picker to explain where the data comes from. */
  source: string;
}

export const EXTRA_META: Record<ExtraSlug, ExtraMeta> = {
  issues: {
    slug: "issues",
    label: "Issues",
    singular: "Issue",
    icon: "CircleDot",
    source: "Issues tab",
  },
  tasks: {
    slug: "tasks",
    label: "Tasks & Lists",
    singular: "Task",
    icon: "ListChecks",
    source: "Tasks tab",
  },
};

export const EXTRA_LIST = Object.values(EXTRA_META);

export function isExtraSlug(slug: string): slug is ExtraSlug {
  return (EXTRA_SLUGS as readonly string[]).includes(slug);
}
