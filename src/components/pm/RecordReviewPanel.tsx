"use client";

import { useState } from "react";
import { AlertTriangle, Check, RotateCcw, Wand2 } from "lucide-react";
import { Badge, Button, Modal, type BadgeVariant } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export interface ReviewFinding {
  field: string;
  label: string;
  problem: string;
  suggestion: string;
  severity: "high" | "medium" | "low";
  /** The value at the time of review, used to show a before/after and to undo. */
  current: string;
}

export interface RecordReview {
  summary: string;
  belongsHere: boolean;
  belongsIn?: string;
  findings: ReviewFinding[];
}

const SEVERITY: Record<ReviewFinding["severity"], { label: string; variant: BadgeVariant }> = {
  high: { label: "Important", variant: "danger" },
  medium: { label: "Worth fixing", variant: "warning" },
  low: { label: "Polish", variant: "neutral" },
};

/**
 * Shows what the AI thinks is wrong with a record and lets the user apply each
 * suggestion one at a time, or all at once.
 *
 * Nothing is applied without a click, and every applied change can be undone
 * from here while the panel is open — the pre-apply value travels with the
 * finding. Applying does not save the record either; the user still has to
 * press Save, so a bad suggestion is never persisted behind their back.
 */
export function RecordReviewPanel({
  open,
  onClose,
  review,
  onApply,
  onUndo,
}: {
  open: boolean;
  onClose: () => void;
  review: RecordReview | null;
  /** Writes the suggestion into the form field. */
  onApply: (field: string, value: string) => void;
  /** Puts the pre-apply value back. */
  onUndo: (field: string, value: string) => void;
}) {
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  const apply = (f: ReviewFinding) => {
    onApply(f.field, f.suggestion);
    setApplied((p) => ({ ...p, [f.field]: true }));
  };

  const undo = (f: ReviewFinding) => {
    onUndo(f.field, f.current);
    setApplied((p) => ({ ...p, [f.field]: false }));
  };

  const applicable = (review?.findings ?? []).filter((f) => f.suggestion);
  const pending = applicable.filter((f) => !applied[f.field]);

  const applyAll = () => {
    pending.forEach((f) => onApply(f.field, f.suggestion));
    setApplied((p) => {
      const next = { ...p };
      pending.forEach((f) => { next[f.field] = true; });
      return next;
    });
  };

  const close = () => {
    setApplied({});
    onClose();
  };

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title="AI review"
      description="Suggestions only. Nothing changes until you apply it, and nothing is saved until you press Save."
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-fg-muted">
            {applicable.length === 0
              ? "No changes proposed."
              : `${applicable.length - pending.length} of ${applicable.length} applied`}
          </span>
          <div className="flex items-center gap-2">
            {pending.length > 1 && (
              <Button variant="outline" size="sm" leftIcon={Wand2} onClick={applyAll}>
                Apply all {pending.length}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      {!review ? null : (
        <div className="space-y-4 text-sm">
          <p className="text-fg leading-6">{review.summary}</p>

          {!review.belongsHere && (
            <div className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <div className="leading-6 text-fg">
                This content may belong somewhere else
                {review.belongsIn ? <> — it reads more like <span className="font-medium">{review.belongsIn}</span></> : null}.
                Nothing has been moved. Decide for yourself and recreate it there if you agree.
              </div>
            </div>
          )}

          {review.findings.length === 0 ? (
            <div className="rounded-lg border border-border bg-bg-subtle px-3 py-6 text-center text-fg-muted">
              Nothing to fix. This record looks fine as it is.
            </div>
          ) : (
            <div className="space-y-3">
              {review.findings.map((f) => {
                const sev = SEVERITY[f.severity];
                const isApplied = applied[f.field];
                return (
                  <div
                    key={f.field}
                    className={cn(
                      "rounded-lg border p-3 space-y-2.5 transition-colors",
                      isApplied ? "border-accent/40 bg-accent/5" : "border-border bg-surface"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-fg">{f.label}</span>
                      <Badge variant={sev.variant} size="sm">{sev.label}</Badge>
                      {isApplied && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                          <Check className="h-3 w-3" aria-hidden /> Applied
                        </span>
                      )}
                    </div>

                    <p className="text-fg-muted leading-6">{f.problem}</p>

                    {f.suggestion ? (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-fg-subtle">Now</div>
                            <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-bg-subtle px-2.5 py-2 text-xs leading-6 text-fg-muted">
                              {f.current || "(empty)"}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-fg-subtle">Suggested</div>
                            <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-accent/30 bg-accent/5 px-2.5 py-2 text-xs leading-6 text-fg">
                              {f.suggestion}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          {isApplied ? (
                            <Button variant="ghost" size="xs" leftIcon={RotateCcw} onClick={() => undo(f)}>
                              Undo
                            </Button>
                          ) : (
                            <Button variant="outline" size="xs" leftIcon={Check} onClick={() => apply(f)}>
                              Apply this
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs italic text-fg-subtle">
                        No replacement text proposed — this one needs your own words.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
