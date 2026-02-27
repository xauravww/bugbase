export const ISSUE_STATUSES = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  VERIFIED: "Verified",
  CLOSED: "Closed",
} as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[keyof typeof ISSUE_STATUSES];

export const STATUS_CONFIG = {
  [ISSUE_STATUSES.OPEN]: {
    label: "Open",
    className: "badge-open",
    color: "#2e75cc",
    bgColor: "#e8f0fb",
  },
  [ISSUE_STATUSES.IN_PROGRESS]: {
    label: "In Progress",
    className: "badge-in-progress",
    color: "#d9730d",
    bgColor: "#fef3e7",
  },
  [ISSUE_STATUSES.IN_REVIEW]: {
    label: "In Review",
    className: "badge-in-review",
    color: "#7b5ea7",
    bgColor: "#f3eff9",
  },
  [ISSUE_STATUSES.VERIFIED]: {
    label: "Verified",
    className: "badge-verified",
    color: "#1f8a4c",
    bgColor: "#e6f4ec",
  },
  [ISSUE_STATUSES.CLOSED]: {
    label: "Closed",
    className: "badge-closed",
    color: "#787774",
    bgColor: "#e4e4e2",
  },
} as const;
