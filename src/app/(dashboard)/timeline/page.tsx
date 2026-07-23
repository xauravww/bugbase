"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table as TableIcon, List as ListIcon, LayoutGrid, Calendar, GanttChart, AlignLeft,
  ChevronLeft, ChevronRight, X, Plus,
} from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Badge, PageLoader, EmptyState, Select, Modal } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { enumColor } from "@/lib/modules/colors";
import { cn } from "@/lib/utils/cn";

type ViewKind = "table" | "list" | "kanban" | "calendar" | "timeline" | "gantt";

interface TItem {
  id: number;
  module: "dev-tasks" | "milestones" | "releases" | "sprints";
  title: string;
  status: string;
  priority?: string;
  assigneeId?: number;
  assigneeName?: string;
  projectId: number;
  projectKey: string;
  startDate?: string | null;
  endDate?: string | null;
  tags?: string;
}

interface ProjectOpt { id: number; name: string; key: string }
interface UserOpt { id: number; name: string }

const MODULE_LABELS: Record<string, string> = {
  "dev-tasks": "Timeline Task", milestones: "Milestone", releases: "Release", sprints: "Sprint",
};
const MODULE_COLORS: Record<string, string> = {
  "dev-tasks": "#6366f1", milestones: "#f59e0b", releases: "#10b981", sprints: "#3b82f6",
};

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDate(v: unknown) {
  const d = toDate(v);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
}
function startOf(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }

const VIEWS: { id: ViewKind; icon: typeof TableIcon; label: string }[] = [
  { id: "table", icon: TableIcon, label: "Table" },
  { id: "list", icon: ListIcon, label: "List" },
  { id: "kanban", icon: LayoutGrid, label: "Kanban" },
  { id: "calendar", icon: Calendar, label: "Calendar" },
  { id: "timeline", icon: AlignLeft, label: "Timeline" },
  { id: "gantt", icon: GanttChart, label: "Gantt" },
];

const MODULES = ["dev-tasks", "milestones", "releases", "sprints"] as const;
type Module = typeof MODULES[number];

const DATE_FIELDS: Record<Module, { start: string; end: string }> = {
  "dev-tasks":  { start: "startDate", end: "dueDate" },
  milestones:   { start: "targetDate", end: "targetDate" },
  releases:     { start: "releaseDate", end: "releaseDate" },
  sprints:      { start: "startDate", end: "endDate" },
};
const TITLE_FIELDS: Record<Module, string> = {
  "dev-tasks": "title", milestones: "name", releases: "version", sprints: "name",
};

function normalizeItem(raw: Record<string, unknown>, mod: Module, projects: ProjectOpt[], users: UserOpt[]): TItem {
  const df = DATE_FIELDS[mod];
  const tf = TITLE_FIELDS[mod];
  const proj = projects.find(p => p.id === Number(raw.projectId));
  const assignee = users.find(u => u.id === Number(raw.assigneeId));
  return {
    id: raw.id as number,
    module: mod,
    title: String(raw[tf] ?? ""),
    status: String(raw.status ?? raw.category ?? ""),
    priority: raw.priority ? String(raw.priority) : undefined,
    assigneeId: raw.assigneeId ? Number(raw.assigneeId) : undefined,
    assigneeName: assignee?.name,
    projectId: Number(raw.projectId),
    projectKey: proj?.key ?? "?",
    startDate: raw[df.start] ? String(raw[df.start]) : null,
    endDate: raw[df.end] ? String(raw[df.end]) : null,
    tags: raw.tags ? String(raw.tags) : undefined,
  };
}

export default function TimelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();

  const [view, setView] = useState<ViewKind>((searchParams.get("view") as ViewKind) || "timeline");
  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [projectFilter, setProjectFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState<Module | "all">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [tlStart, setTlStart] = useState(() => startOf(new Date()));
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createProjectId, setCreateProjectId] = useState("all");

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/projects?limit=200", { headers: authHeaders() }).then(r => r.json()),
      fetch("/api/pm/users", { headers: authHeaders() }).then(r => r.json()),
    ]).then(([pd, ud]) => {
      setProjects(pd.projects || []);
      setUsers(ud.users || []);
    });
  }, [token, authHeaders]);

  useEffect(() => {
    if (projects.length > 0 && createProjectId === "all") {
      setCreateProjectId(String(projects[0].id));
    }
  }, [projects, createProjectId]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const mods: Module[] = moduleFilter === "all" ? [...MODULES] : [moduleFilter];
    const qs = projectFilter !== "all" ? `?projectId=${projectFilter}&limit=200` : "?limit=200";
    const results = await Promise.all(
      mods.map(m => fetch(`/api/pm/${m}${qs}`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({ records: [] })))
    );
    const all: TItem[] = [];
    mods.forEach((m, i) => {
      (results[i].records || []).forEach((raw: Record<string, unknown>) => {
        all.push(normalizeItem(raw, m, projects, users));
      });
    });
    setItems(all);
    setLoading(false);
  }, [token, authHeaders, moduleFilter, projectFilter, projects, users]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    let r = items;
    if (statusFilter !== "all") r = r.filter(i => i.status === statusFilter);
    if (assigneeFilter !== "all") r = r.filter(i => String(i.assigneeId) === assigneeFilter);
    if (search) r = r.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
    if (tagFilter) r = r.filter(i => i.tags?.toLowerCase().includes(tagFilter.toLowerCase()));
    return r;
  }, [items, statusFilter, assigneeFilter, search, tagFilter]);

  const allStatuses = useMemo(() => Array.from(new Set(items.map(i => i.status).filter(Boolean))), [items]);
  const allTags = useMemo(() => {
    const s = new Set<string>();
    items.forEach(i => i.tags?.split(",").map(t => t.trim()).filter(Boolean).forEach(t => s.add(t)));
    return Array.from(s);
  }, [items]);

  const createTargetProjectId = projectFilter !== "all"
    ? projectFilter
    : createProjectId !== "all"
      ? createProjectId
      : (projects[0] ? String(projects[0].id) : "");

  const goDetail = (item: TItem) => router.push(`/pm/${item.module}/${item.id}`);
  const goCreateTask = useCallback(() => {
    if (!createTargetProjectId) return;
    const from = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/timeline";
    router.push(`/pm/dev-tasks/new?projectId=${createTargetProjectId}&from=${encodeURIComponent(from)}`);
    setShowCreateTask(false);
  }, [router, createTargetProjectId]);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex items-center gap-0.5 p-0.5 bg-bg-hover rounded-md">
        {VIEWS.map(v => {
          const Icon = v.icon;
          return (
            <button key={v.id} onClick={() => setView(v.id)} title={v.label}
              className={cn("p-1.5 rounded cursor-pointer transition-colors", view === v.id ? "bg-bg text-fg shadow-sm" : "text-fg-muted hover:text-fg")}>
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
      <Select aria-label="Project" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
        options={[{ value: "all", label: "All projects" }, ...projects.map(p => ({ value: String(p.id), label: `${p.key} · ${p.name}` }))]}
        wrapperClassName="min-w-[150px]" searchable />
      <Select aria-label="Module" value={moduleFilter} onChange={e => setModuleFilter(e.target.value as Module | "all")}
        options={[{ value: "all", label: "All modules" }, ...MODULES.map(m => ({ value: m, label: MODULE_LABELS[m] + "s" }))]}
        wrapperClassName="min-w-[130px]" />
      <Select aria-label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        options={[{ value: "all", label: "All status" }, ...allStatuses.map(s => ({ value: s, label: s }))]}
        wrapperClassName="min-w-[130px]" />
      <Select aria-label="Assignee" value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
        options={[{ value: "all", label: "All assignees" }, ...users.map(u => ({ value: String(u.id), label: u.name }))]}
        wrapperClassName="min-w-[130px]" />
      {allTags.length > 0 && (
        <Select aria-label="Tag" value={tagFilter} onChange={e => setTagFilter(e.target.value)}
          options={[{ value: "", label: "All tags" }, ...allTags.map(t => ({ value: t, label: t }))]}
          wrapperClassName="min-w-[120px]" />
      )}
      <Button
        variant="primary"
        size="sm"
        leftIcon={Plus}
        onClick={() => (projectFilter !== "all" ? goCreateTask() : setShowCreateTask(true))}
        disabled={!createTargetProjectId}
      >
        Add Timeline Task
      </Button>
      {(statusFilter !== "all" || assigneeFilter !== "all" || tagFilter || search) && (
        <Button variant="ghost" size="sm" leftIcon={X} onClick={() => { setStatusFilter("all"); setAssigneeFilter("all"); setTagFilter(""); setSearch(""); }}>Clear</Button>
      )}
      <span className="ml-auto text-sm text-fg-muted">{filtered.length} items</span>
    </div>
  );

  if (loading) return <><Header title="Timeline" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search…" /><PageLoader /></>;

  return (
    <>
      <Header title="Timeline" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search items…" />
      <div className="p-4 md:p-6">
        {toolbar}
        {filtered.length === 0
          ? <EmptyState title="No timeline items" description="Adjust filters or add timeline tasks with dates." />
          : view === "table" ? <TableView items={filtered} onOpen={goDetail} />
          : view === "list" ? <ListView items={filtered} onOpen={goDetail} />
          : view === "kanban" ? <KanbanView items={filtered} onOpen={goDetail} />
          : view === "calendar" ? <CalendarView items={filtered} month={calMonth} onPrev={() => setCalMonth(d => { const n = new Date(d); n.setMonth(n.getMonth()-1); return n; })} onNext={() => setCalMonth(d => { const n = new Date(d); n.setMonth(n.getMonth()+1); return n; })} onOpen={goDetail} />
          : view === "timeline" ? <TimelineView items={filtered} start={tlStart} onPrev={() => setTlStart(d => addDays(d, -14))} onNext={() => setTlStart(d => addDays(d, 14))} onOpen={goDetail} />
          : <GanttView items={filtered} start={tlStart} onPrev={() => setTlStart(d => addDays(d, -14))} onNext={() => setTlStart(d => addDays(d, 14))} onOpen={goDetail} />
        }
      </div>

      <Modal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        title="Add Timeline Task"
        description="Pick the project for this timeline task."
        size="md"
        footer={
          <>
          <Button variant="secondary" onClick={() => setShowCreateTask(false)}>Cancel</Button>
            <Button variant="primary" onClick={goCreateTask} disabled={!createTargetProjectId}>
              Continue
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Project"
            value={createTargetProjectId}
            onChange={(e) => setCreateProjectId(e.target.value)}
            options={projects.map((p) => ({ value: String(p.id), label: `${p.key} · ${p.name}` }))}
            placeholder="Select a project"
            searchable
          />
          <p className="text-sm text-fg-muted leading-6">
            The task editor opens next. Back will return here to Timeline.
          </p>
        </div>
      </Modal>
    </>
  );
}

function ItemBadge({ item }: { item: TItem }) {
  const c = enumColor(item.status);
  return <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ color: c.color, background: c.bg }}>{item.status}</span>;
}
function ModuleDot({ mod }: { mod: string }) {
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: MODULE_COLORS[mod] }} title={MODULE_LABELS[mod]} />;
}
function TagChips({ tags }: { tags?: string }) {
  if (!tags) return null;
  const list = tags.split(",").map(t => t.trim()).filter(Boolean);
  return <>{list.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-hover text-fg-muted">{t}</span>)}</>;
}

function TableView({ items, onOpen }: { items: TItem[]; onOpen: (i: TItem) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-bg-hover text-left">
          <th className="px-4 py-2.5 font-medium text-fg-muted">Title</th>
          <th className="px-4 py-2.5 font-medium text-fg-muted">Module</th>
          <th className="px-4 py-2.5 font-medium text-fg-muted">Project</th>
          <th className="px-4 py-2.5 font-medium text-fg-muted">Status</th>
          <th className="px-4 py-2.5 font-medium text-fg-muted">Assignee</th>
          <th className="px-4 py-2.5 font-medium text-fg-muted">Start</th>
          <th className="px-4 py-2.5 font-medium text-fg-muted">End</th>
          <th className="px-4 py-2.5 font-medium text-fg-muted">Tags</th>
        </tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={`${item.module}-${item.id}`} onClick={() => onOpen(item)} className="border-b border-border last:border-0 hover:bg-bg-hover cursor-pointer group">
              <td className="px-4 py-2.5"><span className="font-medium text-fg group-hover:text-accent">{item.title}</span></td>
              <td className="px-4 py-2.5"><span className="flex items-center gap-1.5"><ModuleDot mod={item.module} />{MODULE_LABELS[item.module]}</span></td>
              <td className="px-4 py-2.5"><Badge variant="neutral" size="sm">{item.projectKey}</Badge></td>
              <td className="px-4 py-2.5"><ItemBadge item={item} /></td>
              <td className="px-4 py-2.5 text-fg-muted">{item.assigneeName ?? "—"}</td>
              <td className="px-4 py-2.5 text-fg-muted whitespace-nowrap">{fmtDate(item.startDate)}</td>
              <td className="px-4 py-2.5 text-fg-muted whitespace-nowrap">{fmtDate(item.endDate)}</td>
              <td className="px-4 py-2.5"><div className="flex gap-1 flex-wrap"><TagChips tags={item.tags} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListView({ items, onOpen }: { items: TItem[]; onOpen: (i: TItem) => void }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
      {items.map(item => (
        <div key={`${item.module}-${item.id}`} onClick={() => onOpen(item)} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover cursor-pointer">
          <ModuleDot mod={item.module} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-fg truncate">{item.title}</span>
              <Badge variant="neutral" size="sm">{item.projectKey}</Badge>
              <ItemBadge item={item} />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-fg-muted flex-wrap">
              {item.assigneeName && <span>{item.assigneeName}</span>}
              {(item.startDate || item.endDate) && <span>{fmtDate(item.startDate)} → {fmtDate(item.endDate)}</span>}
              <TagChips tags={item.tags} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanView({ items, onOpen }: { items: TItem[]; onOpen: (i: TItem) => void }) {
  const statuses = Array.from(new Set(items.map(i => i.status)));
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {statuses.map(s => {
        const c = enumColor(s);
        const group = items.filter(i => i.status === s);
        return (
          <div key={s} className="flex-shrink-0 w-72 bg-bg-hover rounded-lg p-2">
            <div className="flex items-center justify-between px-2 py-1.5 mb-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{s}
              </span>
              <span className="text-xs text-fg-muted">{group.length}</span>
            </div>
            <div className="space-y-2">
              {group.map(item => (
                <button key={`${item.module}-${item.id}`} onClick={() => onOpen(item)}
                  className="w-full text-left bg-bg rounded-md border border-border p-3 hover:border-accent transition-colors cursor-pointer">
                  <div className="flex items-center gap-1.5 mb-1"><ModuleDot mod={item.module} /><span className="font-medium text-sm text-fg line-clamp-2">{item.title}</span></div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="neutral" size="sm">{item.projectKey}</Badge>
                    {item.assigneeName && <span className="text-xs text-fg-muted">{item.assigneeName}</span>}
                    <TagChips tags={item.tags} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ items, month, onPrev, onNext, onOpen }: { items: TItem[]; month: Date; onPrev: () => void; onNext: () => void; onOpen: (i: TItem) => void }) {
  const year = month.getFullYear(), mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const itemsOnDay = (day: number) => {
    const d = new Date(year, mon, day);
    return items.filter(i => {
      const s = toDate(i.startDate), e = toDate(i.endDate);
      if (!s && !e) return false;
      const start = s ?? e!; const end = e ?? s!;
      return d >= startOf(start) && d <= startOf(end);
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onPrev} className="p-1.5 rounded hover:bg-bg-hover cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
        <span className="font-medium text-fg">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button onClick={onNext} className="p-1.5 rounded hover:bg-bg-hover cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="bg-bg-hover px-2 py-1.5 text-xs font-medium text-fg-muted text-center">{d}</div>
        ))}
        {cells.map((day, i) => {
          const dayItems = day ? itemsOnDay(day) : [];
          const isToday = day ? new Date(year, mon, day).toDateString() === new Date().toDateString() : false;
          return (
            <div key={i} className={cn("bg-bg min-h-[80px] p-1.5", !day && "bg-bg-hover/50")}>
              {day && <div className={cn("text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full", isToday ? "bg-accent text-white" : "text-fg-muted")}>{day}</div>}
              <div className="space-y-0.5">
                {dayItems.slice(0, 3).map(item => (
                  <button key={`${item.module}-${item.id}`} onClick={() => onOpen(item)}
                    className="w-full text-left text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                    style={{ background: MODULE_COLORS[item.module] + "33", color: MODULE_COLORS[item.module] }}>
                    {item.title}
                  </button>
                ))}
                {dayItems.length > 3 && <div className="text-[10px] text-fg-muted px-1">+{dayItems.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DAYS_VISIBLE = 28;

function TimelineView({ items, start, onPrev, onNext, onOpen }: { items: TItem[]; start: Date; onPrev: () => void; onNext: () => void; onOpen: (i: TItem) => void }) {
  const days = Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(start, i));
  const end = days[days.length - 1];
  const visible = items.filter(i => {
    const s = toDate(i.startDate) ?? toDate(i.endDate);
    const e = toDate(i.endDate) ?? toDate(i.startDate);
    if (!s || !e) return false;
    return s <= end && e >= start;
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onPrev} className="p-1.5 rounded hover:bg-bg-hover cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
        <span className="font-medium text-fg">{start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <button onClick={onNext} className="p-1.5 rounded hover:bg-bg-hover cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: DAYS_VISIBLE * 36 + 200 }}>
          <div className="flex border-b border-border mb-1">
            <div className="w-48 flex-shrink-0" />
            {days.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={i} className={cn("w-9 flex-shrink-0 text-center text-[10px] py-1", isToday ? "text-accent font-bold" : "text-fg-muted")}>
                  {d.getDate() === 1 || i === 0 ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : d.getDate()}
                </div>
              );
            })}
          </div>
          {visible.map(item => {
            const s = startOf(toDate(item.startDate) ?? toDate(item.endDate)!);
            const e = startOf(toDate(item.endDate) ?? toDate(item.startDate)!);
            const left = Math.max(0, diffDays(start, s));
            const right = Math.min(DAYS_VISIBLE - 1, diffDays(start, e));
            const width = Math.max(1, right - left + 1);
            return (
              <div key={`${item.module}-${item.id}`} className="flex items-center mb-1 group">
                <div className="w-48 flex-shrink-0 flex items-center gap-1.5 pr-2 cursor-pointer" onClick={() => onOpen(item)}>
                  <ModuleDot mod={item.module} />
                  <span className="text-xs text-fg truncate group-hover:text-accent">{item.title}</span>
                </div>
                <div className="flex-1 relative h-7">
                  <div className="absolute inset-y-1 rounded cursor-pointer" style={{ left: left * 36, width: width * 36 - 2, background: MODULE_COLORS[item.module] + "99" }}
                    onClick={() => onOpen(item)} title={item.title} />
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <div className="text-sm text-fg-muted py-8 text-center">No items with dates in this range.</div>}
        </div>
      </div>
    </div>
  );
}

function GanttView({ items, start, onPrev, onNext, onOpen }: { items: TItem[]; start: Date; onPrev: () => void; onNext: () => void; onOpen: (i: TItem) => void }) {
  const days = Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(start, i));
  const end = days[days.length - 1];
  const today = startOf(new Date());
  const todayOffset = diffDays(start, today);
  const visible = items.filter(i => {
    const s = toDate(i.startDate) ?? toDate(i.endDate);
    const e = toDate(i.endDate) ?? toDate(i.startDate);
    if (!s || !e) return false;
    return s <= end && e >= start;
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onPrev} className="p-1.5 rounded hover:bg-bg-hover cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
        <span className="font-medium text-fg">{start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <button onClick={onNext} className="p-1.5 rounded hover:bg-bg-hover cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: DAYS_VISIBLE * 36 + 260 }}>
          <div className="flex border-b border-border mb-1">
            <div className="w-56 flex-shrink-0 text-xs text-fg-muted py-1 px-2">Task / Assignee</div>
            {days.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={i} className={cn("w-9 flex-shrink-0 text-center text-[10px] py-1", isToday ? "text-accent font-bold" : "text-fg-muted")}>
                  {d.getDate() === 1 || i === 0 ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : d.getDate()}
                </div>
              );
            })}
          </div>
          <div className="relative">
            {todayOffset >= 0 && todayOffset < DAYS_VISIBLE && (
              <div className="absolute top-0 bottom-0 w-px bg-accent/50 z-10 pointer-events-none" style={{ left: 256 + todayOffset * 36 }} />
            )}
            {visible.map(item => {
              const s = startOf(toDate(item.startDate) ?? toDate(item.endDate)!);
              const e = startOf(toDate(item.endDate) ?? toDate(item.startDate)!);
              const left = Math.max(0, diffDays(start, s));
              const right = Math.min(DAYS_VISIBLE - 1, diffDays(start, e));
              const width = Math.max(1, right - left + 1);
              const totalDays = Math.max(1, diffDays(s, e) + 1);
              const elapsed = Math.max(0, diffDays(s, today));
              const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));
              const c = enumColor(item.status);
              return (
                <div key={`${item.module}-${item.id}`} className="flex items-center mb-1.5 group">
                  <div className="w-56 flex-shrink-0 pr-2 cursor-pointer" onClick={() => onOpen(item)}>
                    <div className="text-xs text-fg truncate group-hover:text-accent">{item.title}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] px-1 py-0.5 rounded" style={{ color: c.color, background: c.bg }}>{item.status}</span>
                      {item.assigneeName && <span className="text-[10px] text-fg-muted truncate">{item.assigneeName}</span>}
                    </div>
                  </div>
                  <div className="flex-1 relative h-8">
                    <div className="absolute inset-y-1.5 rounded overflow-hidden cursor-pointer"
                      style={{ left: left * 36, width: width * 36 - 2, background: MODULE_COLORS[item.module] + "44", border: `1px solid ${MODULE_COLORS[item.module]}66` }}
                      onClick={() => onOpen(item)} title={item.title}>
                      <div className="h-full rounded" style={{ width: `${pct}%`, background: MODULE_COLORS[item.module] + "99" }} />
                      <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium truncate" style={{ color: MODULE_COLORS[item.module] }}>{item.title}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {visible.length === 0 && <div className="text-sm text-fg-muted py-8 text-center">No items with dates in this range.</div>}
        </div>
      </div>
    </div>
  );
}
