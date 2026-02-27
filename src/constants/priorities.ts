export const ISSUE_PRIORITIES = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
} as const;

export type IssuePriority = (typeof ISSUE_PRIORITIES)[keyof typeof ISSUE_PRIORITIES];

export const PRIORITY_CONFIG = {
  [ISSUE_PRIORITIES.LOW]: {
    label: "Low",
    className: "priority-low",
    color: "#2e75cc",
  },
  [ISSUE_PRIORITIES.MEDIUM]: {
    label: "Medium",
    className: "priority-medium",
    color: "#d9730d",
  },
  [ISSUE_PRIORITIES.HIGH]: {
    label: "High",
    className: "priority-high",
    color: "#eb5757",
  },
  [ISSUE_PRIORITIES.CRITICAL]: {
    label: "Critical",
    className: "priority-critical",
    color: "#8b0000",
  },
} as const;

export const ISSUE_TYPES = {
  BUG: "Bug",
  FEATURE: "Feature",
} as const;

export type IssueType = (typeof ISSUE_TYPES)[keyof typeof ISSUE_TYPES];

export const TYPE_CONFIG = {
  [ISSUE_TYPES.BUG]: {
    label: "Bug",
    className: "badge-bug",
    color: "#c0392b",
    bgColor: "#fde8e8",
  },
  [ISSUE_TYPES.FEATURE]: {
    label: "Feature",
    className: "badge-feature",
    color: "#2e75cc",
    bgColor: "#e8f4fd",
  },
} as const;
