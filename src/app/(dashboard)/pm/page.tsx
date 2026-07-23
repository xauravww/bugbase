"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Rocket, Bug, CheckSquare, AlertTriangle, Flag, Timer, CalendarClock,
  FileText, Activity, TrendingUp, FolderKanban, User,
} from "lucide-react";
import { Header } from "@/components/layout";
import { Card, PageLoader, Badge, EmptyState } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { enumColor } from "@/lib/modules/colors";
import { cn } from "@/lib/utils/cn";

interface Dash {
  empty?: boolean;
  projects: ProjectCard[];
  activeProjectCount: number;
  overallProgress: number;
  upcomingReleases: Row[];
  highPriorityTasks: Row[];
  tasksDueToday: Row[];
  myTasks: Row[];
  openBugs: Row[];
  totalOpenBugs: number;
  sprints: SprintCard[];
  milestones: Row[];
  risks: Row[];
  latestMeetings: Row[];
  recentDocs: Row[];
  recentActivity: ActivityRow[];
}
interface ProjectCard {
  id: number; name: string; key: string; completion: number;
  totalTasks: number; doneTasks: number; openBugs: number; criticalBugs: number;
  requirements: number; features: number; releases: number;
  health: "green" | "yellow" | "red";
}
interface SprintCard { id: number; name: string; projectKey: string; completion: number; totalTasks: number; doneTasks: number }
type Row = Record<string, unknown> & { projectKey?: string };
interface ActivityRow { id: number; module: string; action: string; detail?: string; projectKey?: string; createdAt: string }

const HEALTH: Record<string, string> = { green: "#1a7f4b", yellow: "#d9730d", red: "#c0392b" };

export default function PmDashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("/api/pm/dashboard", { headers: { Authorization: `Bearer ${token}` } });
        setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <><Header title="Workspace" hideSearch /><PageLoader /></>;
  if (!data || data.empty) {
    return (
      <>
        <Header title="Workspace" hideSearch />
        <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project to start planning." />
      </>
    );
  }

  const d = data;

  return (
    <>
      <Header title="Workspace" hideSearch />
      <div className="p-4 md:p-6 space-y-6">
        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={FolderKanban} label="Active Projects" value={d.activeProjectCount} />
          <StatCard icon={TrendingUp} label="Overall Progress" value={`${d.overallProgress}%`} />
          <StatCard icon={Bug} label="Open Bugs" value={d.totalOpenBugs} tone={d.totalOpenBugs > 0 ? "warn" : undefined} />
          <StatCard icon={CheckSquare} label="Due Today" value={d.tasksDueToday.length} tone={d.tasksDueToday.length > 0 ? "warn" : undefined} />
        </div>

        {/* Active projects + health */}
        <Section title="Active Projects" icon={FolderKanban}>
          {d.projects.length === 0 ? <Muted>No projects.</Muted> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {d.projects.map((p) => (
                <Link key={p.id} href={`/pm/dev-tasks?projectId=${p.id}`}>
                  <Card variant="default" className="p-4 hover:border-accent transition-colors h-full">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: HEALTH[p.health] }} title={`Health: ${p.health}`} />
                        <span className="font-semibold text-fg truncate">{p.name}</span>
                        <Badge variant="neutral" size="sm">{p.key}</Badge>
                      </div>
                    </div>
                    {/* progress ring bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-fg-muted mb-1">
                        <span>Completion</span><span>{p.completion}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${p.completion}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <Mini label="Reqs" value={p.requirements} />
                      <Mini label="Features" value={p.features} />
                      <Mini label="Releases" value={p.releases} />
                      <Mini label="Tasks" value={`${p.doneTasks}/${p.totalTasks}`} />
                      <Mini label="Bugs" value={p.openBugs} tone={p.openBugs ? "warn" : undefined} />
                      <Mini label="Critical" value={p.criticalBugs} tone={p.criticalBugs ? "danger" : undefined} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Upcoming Releases" icon={Rocket}>
            <ListWidget rows={d.upcomingReleases} href="/pm/releases"
              title={(r) => String(r.version)} meta={(r) => fmtDate(r.releaseDate)} status={(r) => String(r.status)} />
          </Section>

          <Section title="High Priority Tasks" icon={CheckSquare}>
            <ListWidget rows={d.highPriorityTasks} href="/pm/dev-tasks"
              title={(r) => String(r.title)} meta={(r) => String(r.priority)} status={(r) => String(r.status)} />
          </Section>

          <Section title="Tasks Due Today" icon={CheckSquare}>
            <ListWidget rows={d.tasksDueToday} href="/pm/dev-tasks"
              title={(r) => String(r.title)} meta={(r) => String(r.projectKey)} status={(r) => String(r.status)} />
          </Section>

          <Section title="My Tasks" icon={User}>
            <ListWidget rows={d.myTasks} href="/pm/dev-tasks"
              title={(r) => String(r.title)} meta={(r) => String(r.projectKey)} status={(r) => String(r.status)} />
          </Section>

          <Section title="Open Bugs" icon={Bug}>
            <ListWidget rows={d.openBugs} href="/pm/bugs"
              title={(r) => String(r.title)} meta={(r) => String(r.projectKey)} status={(r) => String(r.severity)} />
          </Section>

          <Section title="Sprint Progress" icon={Timer}>
            {d.sprints.length === 0 ? <Muted>No active sprints.</Muted> : (
              <div className="space-y-3">
                {d.sprints.map((s) => (
                  <Link key={s.id} href="/pm/sprints" className="block">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-fg truncate">{s.name} <span className="text-fg-muted">· {s.projectKey}</span></span>
                      <span className="text-fg-muted">{s.doneTasks}/{s.totalTasks}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${s.completion}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title="Milestones" icon={Flag}>
            <ListWidget rows={d.milestones} href="/pm/milestones"
              title={(r) => String(r.name)} meta={(r) => fmtDate(r.targetDate)} status={(r) => String(r.status)} />
          </Section>

          <Section title="Risks" icon={AlertTriangle}>
            <ListWidget rows={d.risks} href="/pm/risks"
              title={(r) => String(r.title)} meta={(r) => `${r.impact} impact`} status={(r) => String(r.status)} />
          </Section>

          <Section title="Latest Meeting Notes" icon={CalendarClock}>
            <ListWidget rows={d.latestMeetings} href="/pm/meeting-notes"
              title={(r) => String(r.title)} meta={(r) => fmtDate(r.meetingDate)} />
          </Section>

          <Section title="Recently Updated Docs" icon={FileText}>
            <ListWidget rows={d.recentDocs} href="/pm/arch-docs"
              title={(r) => String(r.title ?? r.endpoint)} meta={(r) => String(r.category ?? r.httpMethod ?? r.projectKey)} />
          </Section>
        </div>

        <Section title="Recent Activity" icon={Activity}>
          {d.recentActivity.length === 0 ? <Muted>No activity yet.</Muted> : (
            <div className="divide-y divide-border">
              {d.recentActivity.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-2 text-sm">
                  <Badge variant="neutral" size="sm">{a.projectKey}</Badge>
                  <span className="text-fg">{a.action}</span>
                  <span className="text-fg-subtle text-xs ml-auto">{fmtDate(a.createdAt as unknown as string)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Bug; label: string; value: React.ReactNode; tone?: "warn" | "danger" }) {
  return (
    <Card variant="default" className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center",
          tone === "danger" ? "bg-danger-bg text-danger" : tone === "warn" ? "bg-warning-bg text-warning" : "bg-accent-subtle text-accent")}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold text-fg leading-none">{value}</div>
          <div className="text-xs text-fg-muted mt-1">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Bug; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg mb-3">
        <Icon className="w-4 h-4 text-fg-muted" /> {title}
      </h2>
      {children}
    </div>
  );
}

function ListWidget({ rows, href, title, meta, status }: {
  rows: Row[]; href: string;
  title: (r: Row) => string; meta?: (r: Row) => string; status?: (r: Row) => string;
}) {
  if (!rows.length) return <Muted>Nothing here.</Muted>;
  return (
    <Card variant="default" className="divide-y divide-border p-0 overflow-hidden">
      {rows.map((r, i) => {
        const s = status?.(r);
        const c = s ? enumColor(s) : null;
        return (
          <Link key={i} href={href} className="flex items-center gap-2 px-3 py-2 hover:bg-bg-hover">
            <span className="flex-1 min-w-0 truncate text-sm text-fg">{title(r)}</span>
            {meta && <span className="text-xs text-fg-muted flex-shrink-0">{meta(r)}</span>}
            {s && c && (
              <span className="text-[11px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ color: c.color, background: c.bg }}>{s}</span>
            )}
          </Link>
        );
      })}
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "warn" | "danger" }) {
  return (
    <div className="bg-bg-hover rounded p-1.5">
      <div className={cn("font-semibold", tone === "danger" ? "text-danger" : tone === "warn" ? "text-warning" : "text-fg")}>{value}</div>
      <div className="text-fg-subtle text-[10px]">{label}</div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-fg-muted py-4">{children}</p>;
}

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
