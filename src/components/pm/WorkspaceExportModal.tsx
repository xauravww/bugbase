"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText, Sparkles, Bug, Rocket, Code2, BookOpen, CalendarClock, AlertTriangle,
  Lightbulb, Flag, Timer, ScrollText, Users, Route, Layers, Frame, GitBranch, Scale,
  CheckSquare, FileSpreadsheet, FileDown, Inbox, CircleDot, ListChecks,
} from "lucide-react";
import { META_LIST } from "@/lib/modules/meta";
import { EXTRA_LIST } from "@/lib/modules/export-extras";
import { Button, Modal, Checkbox, useToast } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<string, typeof Bug> = {
  FileText, Sparkles, Bug, Rocket, Code2, BookOpen, CalendarClock, AlertTriangle,
  Lightbulb, Flag, Timer, ScrollText, Users, Route, Layers, Frame, GitBranch, Scale, CheckSquare,
  CircleDot, ListChecks,
};

interface PickerItem {
  slug: string;
  label: string;
  icon: string;
  /** Set for the non-workspace areas (Issues / Tasks tabs). */
  source?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName?: string;
  /** Optional pre-fetched counts; the modal fetches its own if omitted. */
  counts?: Record<string, number> | null;
}

/**
 * Picker for a whole-workspace export. Only modules holding at least one
 * record are listed — an export of nothing but placeholders helps nobody —
 * and the chosen set is handed to /api/pm/export as PDF or XLSX.
 */
export function WorkspaceExportModal({ isOpen, onClose, projectId, projectName, counts: countsProp }: Props) {
  const { token } = useAuth();
  const toast = useToast();
  const [counts, setCounts] = useState<Record<string, number> | null>(countsProp ?? null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);

  useEffect(() => {
    if (countsProp) setCounts(countsProp);
  }, [countsProp]);

  // Refetch on open so the picker never offers a module that was just emptied.
  useEffect(() => {
    if (!isOpen || !token) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/pm/counts?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`counts request failed: ${res.status}`);
        const data = await res.json();
        if (mounted) setCounts(data.counts ?? {});
      } catch (err) {
        console.error("Failed to fetch export counts", err);
        if (mounted) setCounts({});
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, projectId, token]);

  const hasRecords = (slug: string) => (counts?.[slug] ?? 0) > 0;

  const workspaceItems: PickerItem[] = useMemo(
    () => META_LIST.filter((m) => hasRecords(m.slug)).map((m) => ({ slug: m.slug, label: m.label, icon: m.icon })),
    // hasRecords closes over counts, which is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counts]
  );

  const extraItems: PickerItem[] = useMemo(
    () => EXTRA_LIST.filter((e) => hasRecords(e.slug)).map((e) => ({
      slug: e.slug, label: e.label, icon: e.icon, source: e.source,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counts]
  );

  const available = useMemo(() => [...workspaceItems, ...extraItems], [workspaceItems, extraItems]);

  // Default to everything selected each time the dialog opens.
  useEffect(() => {
    if (isOpen && counts) setSelected(new Set(available.map((m) => m.slug)));
  }, [isOpen, counts, available]);

  const totalRecords = available
    .filter((m) => selected.has(m.slug))
    .reduce((sum, m) => sum + (counts?.[m.slug] ?? 0), 0);

  const allOn = available.length > 0 && selected.size === available.length;

  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const toggleAll = () =>
    setSelected(allOn ? new Set() : new Set(available.map((m) => m.slug)));

  const runExport = async (format: "pdf" | "excel") => {
    if (selected.size === 0 || !token) return;
    setBusy(format);
    try {
      const params = new URLSearchParams({
        projectId: String(projectId),
        format,
        modules: available.filter((m) => selected.has(m.slug)).map((m) => m.slug).join(","),
      });
      const res = await fetch(`/api/pm/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        throw new Error(msg?.error || `Export failed (${res.status})`);
      }
      // Filename comes from Content-Disposition so the server owns the naming.
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] || `workspace-export.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${selected.size} ${selected.size === 1 ? "section" : "sections"}`, {
        description: format === "pdf" ? "PDF downloaded" : "Excel workbook downloaded",
      });
      onClose();
    } catch (err) {
      console.error("Workspace export failed", err);
      toast.error("Export failed", { description: err instanceof Error ? err.message : "Please try again" });
    } finally {
      setBusy(null);
    }
  };

  const renderGroup = (heading: string, items: PickerItem[]) => {
    if (items.length === 0) return null;
    const groupOn = items.every((i) => selected.has(i.slug));
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{heading}</span>
          <button
            type="button"
            onClick={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                for (const i of items) {
                  if (groupOn) next.delete(i.slug);
                  else next.add(i.slug);
                }
                return next;
              })
            }
            className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
          >
            {groupOn ? "Clear" : "Select"}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {items.map((m) => {
            const Icon = ICONS[m.icon] ?? FileText;
            const on = selected.has(m.slug);
            return (
              <button
                key={m.slug}
                type="button"
                onClick={() => toggle(m.slug)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer",
                  on ? "border-accent/40 bg-accent-subtle" : "border-border bg-surface hover:bg-bg-hover"
                )}
              >
                {/* Purely visual — the whole row is the click target. */}
                <Checkbox checked={on} size="sm" tabIndex={-1} className="pointer-events-none" />
                <Icon className={cn("w-4 h-4 shrink-0", on ? "text-accent" : "text-fg-subtle")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg truncate">{m.label}</span>
                  {m.source && (
                    <span className="block text-[10px] text-fg-subtle truncate">from {m.source}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full tabular-nums",
                    on ? "bg-accent text-white" : "bg-bg-subtle text-fg-muted"
                  )}
                >
                  {counts?.[m.slug] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      size="xl"
      title="Export workspace"
      description={
        projectName
          ? `Choose what to include from ${projectName} — workspace modules plus Issues and Tasks.`
          : "Choose what to include — workspace modules plus Issues and Tasks."
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
          <span className="text-xs text-fg-subtle">
            {selected.size === 0
              ? "Nothing selected"
              : `${selected.size} ${selected.size === 1 ? "section" : "sections"} · ${totalRecords} ${totalRecords === 1 ? "record" : "records"}`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={!!busy}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={FileSpreadsheet}
              onClick={() => runExport("excel")}
              loading={busy === "excel"}
              disabled={selected.size === 0 || !!busy}
            >
              Export to Excel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={FileDown}
              onClick={() => runExport("pdf")}
              loading={busy === "pdf"}
              disabled={selected.size === 0 || !!busy}
            >
              Export to PDF
            </Button>
          </div>
        </div>
      }
    >
      {loading && !counts ? (
        <div className="py-10 text-center text-sm text-fg-muted">Loading sections…</div>
      ) : available.length === 0 ? (
        <div className="py-10 flex flex-col items-center gap-2 text-center">
          <Inbox className="w-6 h-6 text-fg-subtle" />
          <p className="text-sm font-medium text-fg">Nothing to export yet</p>
          <p className="text-xs text-fg-muted max-w-xs">
            This project has no workspace records, issues or tasks. Add something first, then export.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
            <Checkbox
              checked={allOn ? true : selected.size === 0 ? false : "indeterminate"}
              onCheckedChange={toggleAll}
              label={<span className="text-sm font-medium text-fg">Select all</span>}
            />
            <span className="text-xs text-fg-subtle">
              {available.length} {available.length === 1 ? "section has" : "sections have"} records
            </span>
          </div>

          <div className="max-h-[46vh] overflow-y-auto pr-1 flex flex-col gap-4">
            {renderGroup("Workspace modules", workspaceItems)}
            {renderGroup("Outside the workspace", extraItems)}
          </div>

          <p className="mt-3 text-xs text-fg-subtle">
            Empty fields are printed as &ldquo;No item present&rdquo;. Sections with no records are hidden.
          </p>
        </>
      )}
    </Modal>
  );
}
