"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText, Sparkles, Bug, Rocket, Code2, BookOpen,
  CalendarClock, AlertTriangle, Lightbulb, Flag, Timer, FlaskConical,
} from "lucide-react";
import { META_LIST } from "@/lib/modules/meta";
import { ModuleWorkspace } from "./ModuleWorkspace";
import { TestCasesWorkspace } from "@/components/test-cases/TestCasesWorkspace";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<string, typeof Bug> = {
  FileText, Sparkles, Bug, Rocket, Code2, BookOpen,
  CalendarClock, AlertTriangle, Lightbulb, Flag, Timer,
};

// Tasks live in the project's own "Tasks" tab, so drop dev-tasks here.
const PANEL_MODULES = META_LIST.filter((m) => !["dev-tasks", "features", "bugs"].includes(m.slug));
// Test Cases is a first-class project feature (not a registry module) — pin it.
const TEST_CASES = "test-cases";

/**
 * Embedded PM workspace for one project. Chip nav switches the active module;
 * the ModuleWorkspace below is scoped to this project. The active module is
 * mirrored to the `wsmod` query param so the browser back button (from a
 * record detail page) restores the same chip.
 */
export function ProjectWorkspacePanel({ projectId }: { projectId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("wsmod") || PANEL_MODULES[0].slug;

  const setActive = useCallback((slug: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("tab", "workspace");
    params.set("wsmod", slug);
    router.replace(`/projects/${projectId}?${params.toString()}`, { scroll: false });
  }, [router, searchParams, projectId]);

  const chips = [
    ...PANEL_MODULES.map((m) => ({ slug: m.slug, label: m.label, icon: ICONS[m.icon] ?? FileText })),
    { slug: TEST_CASES, label: "Test Cases", icon: FlaskConical },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-hover" style={{ width: "fit-content", minWidth: "max-content" }}>
          {chips.map((c) => {
            const Icon = c.icon;
            const on = active === c.slug;
            return (
              <button
                key={c.slug}
                onClick={() => setActive(c.slug)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer",
                  on ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {active === TEST_CASES ? (
        <TestCasesWorkspace projectId={projectId} />
      ) : (
        <ModuleWorkspace key={active} slug={active} fixedProjectId={projectId} embedded />
      )}
    </div>
  );
}
