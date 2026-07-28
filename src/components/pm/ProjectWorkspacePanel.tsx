"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText, Sparkles, Bug, Rocket, Code2, BookOpen,
  CalendarClock, AlertTriangle, Lightbulb, Flag, Timer, FlaskConical, Plus,
  ScrollText, Users, Route, Layers, Frame, GitBranch, Scale,
} from "lucide-react";
import { META_LIST, getMeta } from "@/lib/modules/meta";
import { ModuleWorkspace } from "./ModuleWorkspace";
import { Button } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";

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
  const { user } = useAuth();
  const active = searchParams.get("wsmod") || PANEL_MODULES[0].slug;
  const canWrite = user?.role !== "Viewer";
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    const fetchCounts = async () => {
      try {
        const promises = PANEL_MODULES.map(async (m) => {
          const res = await fetch(`/api/pm/${m.slug}?projectId=${projectId}&limit=1&page=1`);
          if (res.ok) {
            const data = await res.json();
            return { slug: m.slug, total: data.pagination?.total || 0 };
          }
          return { slug: m.slug, total: 0 };
        });
        const results = await Promise.all(promises);
        if (!mounted) return;
        const newCounts: Record<string, number> = {};
        results.forEach(r => {
          newCounts[r.slug] = r.total;
        });
        setCounts(newCounts);
      } catch (err) {
        console.error("Failed to fetch counts", err);
      }
    };
    fetchCounts();
    return () => { mounted = false; };
  }, [projectId]);

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

  const chips = PANEL_MODULES.map((m) => ({ slug: m.slug, label: m.label, icon: ICONS[m.icon] ?? FileText }));

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start h-full">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-[220px] md:shrink-0 flex flex-col gap-4">
        {canWrite && activeMeta && (
          <div className="px-1 md:px-0 hidden md:block">
            <Button variant="primary" size="sm" leftIcon={Plus} onClick={goCreate} className="w-full justify-center">
              New {activeMeta.singular}
            </Button>
          </div>
        )}

        <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:max-h-[calc(100vh-150px)] gap-1 pb-2 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {chips.map((c) => {
            const Icon = c.icon;
            const on = active === c.slug;
            const count = counts[c.slug];
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
                  <span className={cn(
                    "ml-3 text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-colors",
                    on ? "bg-bg text-fg-muted shadow-sm" : "bg-bg-hover text-fg-muted group-hover:bg-bg-subtle"
                  )}>
                    {count}
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
        {canWrite && activeMeta && (
          <div className="mb-4 md:hidden">
            <Button variant="primary" size="sm" leftIcon={Plus} onClick={goCreate} className="w-full justify-center">
              New {activeMeta.singular}
            </Button>
          </div>
        )}
        <ModuleWorkspace key={active} slug={active} fixedProjectId={projectId} embedded />
      </div>
    </div>
  );
}
