"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText, Sparkles, Bug, Rocket, Code2, BookOpen,
  CalendarClock, AlertTriangle, Lightbulb, Flag, Timer, Plus, Download,
  ScrollText, Users, Route, Layers, Frame, GitBranch, Scale,
} from "lucide-react";
import { META_LIST, getMeta } from "@/lib/modules/meta";
import { ModuleWorkspace } from "./ModuleWorkspace";
import { WorkspaceExportModal } from "./WorkspaceExportModal";
import { Button } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

const ICONS: Record<string, typeof Bug> = {
  FileText, Sparkles, Bug, Rocket, Code2, BookOpen,
  CalendarClock, AlertTriangle, Lightbulb, Flag, Timer,
  ScrollText, Users, Route, Layers, Frame, GitBranch, Scale,
};

// Tasks live in the project's own "Tasks" tab. Bugs and Features are first-class
// workspace modules, so keep them available here rather than duplicating them in Issues.
const PANEL_MODULES = META_LIST.filter((m) => m.slug !== "dev-tasks");

/**
 * Embedded PM workspace for one project. Sidebar nav switches the active module;
 * the ModuleWorkspace below is scoped to this project. The active module is
 * mirrored to the `wsmod` query param so the browser back button (from a
 * record detail page) restores the same chip.
 */
export function ProjectWorkspacePanel({ projectId }: { projectId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const active = searchParams.get("wsmod") || PANEL_MODULES[0].slug;
  const canWrite = user?.role !== "Viewer";
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [countsNonce, setCountsNonce] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);

  // One request covers every module's badge. Counts stay null until it lands so
  // an empty module and a not-yet-loaded one do not both render as "0".
  // Bumping countsNonce refetches, which keeps a badge honest after the child
  // workspace adds or removes a record.
  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/pm/counts?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`counts request failed: ${res.status}`);
        const data = await res.json();
        if (mounted) setCounts(data.counts ?? {});
      } catch (err) {
        console.error("Failed to fetch workspace counts", err);
        if (mounted) setCounts({});
      }
    })();
    return () => { mounted = false; };
  }, [projectId, token, countsNonce]);

  const refreshCounts = useCallback(() => setCountsNonce((n) => n + 1), []);

  const setActive = useCallback((slug: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("tab", "workspace");
    params.set("wsmod", slug);
    router.replace(`/projects/${projectId}?${params.toString()}`, { scroll: false });
  }, [router, searchParams, projectId]);

  const activeMeta = getMeta(active);

  const goCreate = useCallback(() => {
    const q = `projectId=${projectId}&from=${encodeURIComponent(`/projects/${projectId}?tab=workspace&wsmod=${active}`)}`;
    router.push(`/pm/${active}/new?${q}`);
  }, [router, projectId, active]);

  const chips = PANEL_MODULES.map((m) => ({
    slug: m.slug, label: m.label, singular: m.singular, icon: ICONS[m.icon] ?? FileText,
  }));

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start h-full">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-[220px] md:shrink-0 flex flex-col gap-4">
        <div className="px-1 md:px-0 hidden md:flex flex-col gap-2">
          {canWrite && activeMeta && (
            <Button variant="primary" size="sm" leftIcon={Plus} onClick={goCreate} className="w-full justify-center">
              New {activeMeta.singular}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Download}
            onClick={() => setExportOpen(true)}
            className="w-full justify-center"
          >
            Export workspace
          </Button>
        </div>

        <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:max-h-[calc(100vh-150px)] gap-1 pb-2 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {chips.map((c) => {
            const Icon = c.icon;
            const on = active === c.slug;
            const count = counts?.[c.slug];
            // Dim only once counts are known to be zero, never while loading.
            const isZero = count === 0;

            return (
              <button
                key={c.slug}
                onClick={() => setActive(c.slug)}
                className={cn(
                  "relative flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 md:w-full group",
                  on ? "bg-bg-selected text-fg" : "text-fg-muted hover:bg-bg-hover hover:text-fg",
                  !on && isZero ? "opacity-40" : ""
                )}
              >
                {/* Left Accent Bar for Desktop */}
                {on && (
                  <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full" />
                )}
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{c.label}</span>
                </div>
                {count !== undefined && (
                  <span
                    // Compact form keeps a four-digit count from widening the nav;
                    // the title carries the exact number.
                    title={`${count.toLocaleString()} ${count === 1 ? c.singular.toLowerCase() : c.label.toLowerCase()}`}
                    className={cn(
                      "ml-3 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors",
                      on ? "bg-bg text-fg-muted shadow-sm" : "bg-bg-hover text-fg-muted group-hover:bg-bg-subtle"
                    )}
                  >
                    {formatNumber(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 min-w-0 w-full">
        {/* Mobile Header / Create Button */}
        <div className="mb-4 md:hidden flex gap-2">
          {canWrite && activeMeta && (
            <Button variant="primary" size="sm" leftIcon={Plus} onClick={goCreate} className="flex-1 justify-center">
              New {activeMeta.singular}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Download}
            onClick={() => setExportOpen(true)}
            className="flex-1 justify-center"
          >
            Export
          </Button>
        </div>
        <ModuleWorkspace key={active} slug={active} fixedProjectId={projectId} embedded onRecordsChanged={refreshCounts} />
      </div>

      <WorkspaceExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        projectId={projectId}
        counts={counts}
      />
    </div>
  );
}
