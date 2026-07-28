"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Modal, Tooltip } from "@/components/ui";
import { getModuleHelp } from "@/lib/modules/help";
import { getMeta } from "@/lib/modules/meta";
import { cn } from "@/lib/utils/cn";

/**
 * Page-level ℹ button for a PM module. Opens a modal that explains, in plain
 * language, what this page is for, what belongs here, what does NOT (and where
 * it goes instead), and shows one fully filled-in example record.
 *
 * This is the module-level counterpart to `FieldHelpButton`, which explains a
 * single field. Rendered next to a module title / in a workspace header.
 */
export function ModuleHelpButton({
  slug,
  className,
  variant = "icon",
}: {
  slug: string;
  className?: string;
  /** "icon" is a bare ℹ circle; "labelled" adds a visible "What goes here?" label. */
  variant?: "icon" | "labelled";
}) {
  const [open, setOpen] = useState(false);
  const meta = getMeta(slug);
  const help = getModuleHelp(slug);
  if (!meta || !help) return null;

  const trigger =
    variant === "labelled" ? (
      <button
        type="button"
        aria-label={`What goes on the ${meta.label} page?`}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5",
          "text-xs font-medium text-fg-muted cursor-pointer",
          "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
          "hover:border-border-strong hover:bg-bg-hover hover:text-fg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
          className
        )}
      >
        <Info className="w-3.5 h-3.5" aria-hidden />
        What goes here?
      </button>
    ) : (
      <button
        type="button"
        aria-label={`What goes on the ${meta.label} page?`}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          "border border-border bg-surface text-fg-muted cursor-pointer",
          "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
          "hover:border-border-strong hover:bg-bg-hover hover:text-fg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
          className
        )}
      >
        <Info className="w-3.5 h-3.5" aria-hidden />
      </button>
    );

  return (
    <>
      <Tooltip content={`What goes on the ${meta.label} page?`} side="bottom" delay={180}>
        {trigger}
      </Tooltip>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={meta.label}
        description="What this page is for, in plain language."
        size="xl"
      >
        <div className="space-y-5 text-sm">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-fg-subtle">What it is</div>
            <p className="text-fg leading-6">{help.whatItIs}</p>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-fg-subtle">Why it matters</div>
            <p className="text-fg leading-6">{help.whyItMatters}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-bg-subtle p-3 space-y-2">
              <div className="text-xs font-medium text-fg">Write this here</div>
              <ul className="space-y-1.5">
                {help.writeThis.map((item) => (
                  <li key={item} className="flex gap-2 text-fg-muted leading-6">
                    <span aria-hidden className="mt-[2px] text-accent">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-bg-subtle p-3 space-y-2">
              <div className="text-xs font-medium text-fg">Not here</div>
              <ul className="space-y-1.5">
                {help.notThis.map((item) => (
                  <li key={item} className="flex gap-2 text-fg-muted leading-6">
                    <span aria-hidden className="mt-[2px] text-fg-subtle">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-fg-subtle">
              Example {meta.singular.toLowerCase()}
            </div>
            <div className="divide-y divide-border rounded-lg border border-border bg-surface">
              {help.example.map((row) => (
                <div key={row.label} className="grid gap-1 px-3 py-2 sm:grid-cols-[150px_1fr] sm:gap-3">
                  <div className="text-xs font-medium text-fg-subtle sm:pt-[3px]">{row.label}</div>
                  <div className="whitespace-pre-wrap text-fg leading-6">{row.value}</div>
                </div>
              ))}
            </div>
          </div>

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
