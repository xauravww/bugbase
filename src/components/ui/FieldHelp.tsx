"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Modal } from "./Modal";
import { Tooltip } from "./Tooltip";
import { cn } from "@/lib/utils/cn";

export type FieldHelpKind =
  | "text"
  | "password"
  | "email"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "richtext"
  | "relation"
  | "tags";

export interface FieldHelpContent {
  whatItIs: string;
  whyItMatters?: string;
  example: string;
  template: string;
  tip?: string;
  optionDetails?: Array<{
    label: string;
    description: string;
    example?: string;
  }>;
}

export interface FieldHelpSource {
  label: string;
  kind?: FieldHelpKind;
  placeholder?: string;
  options?: string[];
}

function trimValue(value?: string) {
  return value?.trim() || "";
}

function shortList(values: string[], max = 3) {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  return clean.slice(0, max).join(", ");
}

type OptionDetail = {
  label: string;
  description: string;
  example?: string;
};

function describeSelectOption(fieldLabel: string, option: string, index: number, total: number): string {
  const lower = option.trim().toLowerCase();
  const field = fieldLabel.toLowerCase();

  if (!lower) return "Choose this if it matches the item.";

  if (field.includes("priority") || field.includes("severity") || field.includes("impact") || field.includes("probability")) {
    if (lower.includes("low")) return "Small impact. Use when this is not urgent and can wait.";
    if (lower.includes("medium")) return "Normal impact. Use when this matters, but it is not urgent.";
    if (lower.includes("high")) return "Important. Use when it needs attention soon.";
    if (lower.includes("critical")) return "Very urgent. Use when this blocks work or causes major risk.";
  }

  if (field.includes("status")) {
    if (lower.includes("draft")) return "Work is not final yet. Use while it is still being written.";
    if (lower.includes("proposed") || lower.includes("new")) return "A fresh item that has been created but not started.";
    if (lower.includes("todo") || lower.includes("planned") || lower.includes("upcoming") || lower.includes("backlog")) return "Scheduled or waiting to be worked on.";
    if (lower.includes("open") || lower.includes("active")) return "Ready to work on now, but not finished.";
    if (lower.includes("in progress") || lower.includes("doing")) return "Someone is actively working on it right now.";
    if (lower.includes("review") || lower.includes("testing") || lower.includes("qa")) return "The work is done enough to check before it closes.";
    if (lower.includes("approved")) return "Checked and accepted. It can move to the next step.";
    if (lower.includes("done") || lower.includes("resolved") || lower.includes("released") || lower.includes("completed")) return "Finished successfully.";
    if (lower.includes("closed")) return "No longer active. Use when the item is finished or not being worked on.";
    if (lower.includes("cancel") || lower.includes("rejected") || lower.includes("won")) return "Stopped intentionally or not accepted.";
    if (lower.includes("archived")) return "Kept for reference only. Not part of active work.";
    if (lower.includes("mitigating")) return "Work is underway to reduce the risk or impact.";
    if (lower.includes("stable")) return "Working as expected and safe to use.";
    if (lower.includes("deprecated")) return "Old and should not be used for new work.";
    if (lower.includes("needs revision")) return "Needs changes before it can move forward.";
    if (lower.includes("rolled back")) return "A release was reverted because of a problem.";
  }

  if (field.includes("environment")) {
    if (lower.includes("dev")) return "Use while testing locally or during development.";
    if (lower.includes("staging")) return "Use for pre-release testing before production.";
    if (lower.includes("prod")) return "Use when the problem happens in the live product.";
  }

  if (field.includes("role")) {
    if (lower.includes("admin")) return "Full access. Use for trusted people who manage the product.";
    if (lower.includes("viewer")) return "Read-only access. Use for people who should not edit.";
    if (lower.includes("member")) return "Standard access for regular contributors.";
    if (lower.includes("owner")) return "The person who owns the workspace or project.";
  }

  if (field.includes("type")) {
    return `Use this when the item is best described as ${option}.`;
  }

  if (total <= 3) {
    return `Choose this when the item clearly matches ${option}.`;
  }

  if (index === 0) return `Use this for the most common case: ${option}.`;
  if (index === total - 1) return `Use this for the rarest or strongest case: ${option}.`;
  return `Use this when the item fits ${option}.`;
}

function buildOptionDetails(fieldLabel: string, options: string[]): OptionDetail[] {
  return options.reduce<OptionDetail[]>((acc, opt, index) => {
    const label = opt.trim();
    if (!label) return acc;
    acc.push({
      label,
      description: describeSelectOption(fieldLabel, label, index, options.length),
      example: label,
    });
    return acc;
  }, []);
}

export function buildFieldHelp({ label, kind = "text", placeholder, options = [] }: FieldHelpSource): FieldHelpContent {
  const title = label.trim();
  const lower = title.toLowerCase();
  const firstOption = options[0] || "";
  const secondOption = options[1] || "";
  const sample = trimValue(placeholder) || firstOption || title;

  if (lower.includes("password")) {
    return {
      whatItIs: "Use this for a secret sign-in value that only the user should know.",
      whyItMatters: "This protects the account and keeps other people out.",
      example: "StrongPass123!",
      template: "Use 8 or more characters with a mix of letters, numbers, and symbols.",
      tip: "Do not reuse the same password everywhere, and avoid names or common words.",
    };
  }

  if (lower.includes("email")) {
    return {
      whatItIs: "Use this for an email address people can reach for updates, login, or contact.",
      whyItMatters: "This is how the system sends messages and identifies the person.",
      example: "alex@example.com",
      template: "name@example.com",
      tip: "Make sure the address is spelled correctly, because one wrong character breaks it.",
    };
  }

  if (lower.includes("project key") || lower === "key") {
    return {
      whatItIs: "Use this as a short code for the project so it is easy to identify everywhere.",
      whyItMatters: "This makes the project easy to spot in lists, exports, and shortcuts.",
      example: "BUG",
      template: "2 to 6 uppercase letters, like BUG or CRM.",
      tip: "Keep it short so it is easy to type, easy to scan, and hard to confuse with another project.",
    };
  }

  if (lower.includes("name")) {
    return {
      whatItIs: "Use this for a short name people will see first in lists, cards, or drop-downs.",
      whyItMatters: "This is usually the first thing people read when they scan the app.",
      example: sample,
      template: sample,
      tip: "Keep it clear and easy to understand. If someone only reads this field, they should still know what it is.",
    };
  }

  if (lower.includes("title") || lower.includes("subject")) {
    return {
      whatItIs: "Use this for a short line that says what the item is about.",
      whyItMatters: "This helps people find the item quickly and understand it at a glance.",
      example: sample,
      template: sample,
      tip: "A good title is short but specific. Avoid generic words like 'update' or 'thing'.",
    };
  }

  if (lower.includes("description") || lower.includes("body") || lower.includes("notes") || kind === "textarea" || kind === "richtext") {
    return {
      whatItIs: "Use this to explain the item in simple words so someone else can understand it without asking you.",
      whyItMatters: "This gives the next person enough detail to act on it without guessing.",
      example: "The checkout button is hard to tap on small screens.",
      template: "Write 1 to 3 short sentences. Say what it is and what should happen next.",
      tip: "Plain language is best. Write like you are explaining it to a teammate who is seeing it for the first time.",
    };
  }

  if (lower.includes("priority") || lower.includes("severity")) {
    return {
      whatItIs: "Use this to show how important, risky, or urgent it is.",
      whyItMatters: "This helps the team decide what to do first.",
      example: firstOption || "High",
      template: "Pick the option that matches the impact best. Start with the most serious case, not the most convenient one.",
      tip: "If you are unsure, choose the closest match and move on. Do not overthink it.",
      optionDetails: buildOptionDetails(title, options),
    };
  }

  if (lower.includes("status")) {
    return {
      whatItIs: "Use this to show the current stage of the item right now.",
      whyItMatters: "This helps people know whether the item is new, active, finished, or blocked.",
      example: firstOption || "Open",
      template: "Choose the status that matches what is happening now, not what you want it to become later.",
      tip: "Status should describe the present state, not the future one.",
      optionDetails: buildOptionDetails(title, options),
    };
  }

  if (kind === "select") {
    return {
      whatItIs: "Choose one option from the list that best matches the item.",
      whyItMatters: "This keeps the field consistent so it is easier to filter and search later.",
      example: firstOption || secondOption || "Open",
      template: firstOption ? `Pick ${firstOption} when this is the most natural fit.` : "Pick the option that fits best.",
      tip: "Select the closest match if none of the options are perfect. Do not leave it blank unless the field allows that.",
      optionDetails: buildOptionDetails(title, options),
    };
  }

  if (kind === "relation") {
    return {
      whatItIs: "Use this to link this item to another record so the connection is visible later.",
      whyItMatters: "This keeps related work connected instead of scattered across the app.",
      example: sample,
      template: "Choose the item this record should connect to, such as a project, task, feature, or requirement.",
      tip: "Leave it blank if nothing should be linked. Add a link only when the connection helps the reader.",
    };
  }

  if (kind === "tags") {
    return {
      whatItIs: "Use this for a few short keywords that make the item easy to find later.",
      whyItMatters: "This makes filtering and searching much faster later.",
      example: shortList(options) || "api, frontend, urgent",
      template: "Type words separated by commas, like api, frontend, or urgent.",
      tip: "Keep tags short so they stay easy to scan and search.",
    };
  }

  if (kind === "date") {
    return {
      whatItIs: "Use this to pick a calendar date for when something starts, ends, or happens.",
      whyItMatters: "This helps the item show up in the right timeline or schedule view.",
      example: "2026-07-23",
      template: "Pick the date that matches when this starts, ends, or happens.",
      tip: "You can use the calendar picker instead of typing the date. Use the same date format as the rest of the app.",
    };
  }

  if (kind === "number") {
    return {
      whatItIs: "Use this for a number only, such as a count, score, or estimate.",
      whyItMatters: "This lets the app sort, total, or compare the value correctly.",
      example: "3",
      template: "Type a plain number with no extra text, like 3 or 12.",
      tip: "Use whole numbers unless the field clearly needs decimals.",
    };
  }

  return {
    whatItIs: "Use this for a short piece of information that does not need a richer editor.",
    whyItMatters: "This keeps the record readable without making the form heavier than it needs to be.",
    example: sample,
    template: sample,
    tip: "Keep the answer as short as the field allows, but still specific enough to be useful later.",
  };
}

export function FieldHelpButton({
  label,
  content,
  kind = "text",
  placeholder,
  options,
  className,
}: {
  label: string;
  content?: Partial<FieldHelpContent>;
  kind?: FieldHelpKind;
  placeholder?: string;
  options?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const help = useMemo(
    () => ({ ...buildFieldHelp({ label, kind, placeholder, options }), ...content }),
    [label, kind, placeholder, options, content]
  );

  return (
    <>
      <Tooltip content={`Open help for ${label}`} side="top" delay={180}>
        <button
          type="button"
          aria-label={`Open help for ${label}`}
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            "border border-border bg-surface text-[10px] font-semibold text-fg-muted",
            "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
            "hover:border-border-strong hover:bg-bg-hover hover:text-fg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
            className
          )}
        >
          <Info className="w-3 h-3" aria-hidden />
        </button>
      </Tooltip>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label}
        description="Quick help in plain language."
        size="md"
      >
        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-fg-subtle">What it is</div>
            <p className="text-fg leading-6">{help.whatItIs}</p>
          </div>

          {help.whyItMatters && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-fg-subtle">Why it matters</div>
              <p className="text-fg leading-6">{help.whyItMatters}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-fg-subtle">Example</div>
            <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 font-medium text-fg leading-6">
              {help.example}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-fg-subtle">Template</div>
            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-fg-muted leading-6">
              {help.template}
            </div>
          </div>

          {help.optionDetails && help.optionDetails.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-fg-subtle">Options explained</div>
              <div className="space-y-2">
                {help.optionDetails.map((opt) => (
                  <div key={opt.label} className="rounded-lg border border-border bg-bg-subtle px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-fg leading-6">{opt.label}</div>
                      {opt.example && (
                        <div className="text-[11px] text-fg-muted whitespace-nowrap">Example: {opt.example}</div>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-fg-muted leading-6">{opt.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {help.tip && (
            <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-fg leading-6">
              <span className="font-medium text-fg">Tip: </span>
              {help.tip}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
