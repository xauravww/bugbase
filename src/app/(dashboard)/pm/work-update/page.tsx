"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles, ClipboardCopy, Check, RefreshCw, ChevronLeft, ChevronRight,
  Pencil, Trash2, Wand2, Plus, X,
} from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Card, DatePicker, PageLoader, Select, Textarea } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";

interface ProjectOption { id: number; name: string; key: string }
interface MemberOption  { id: number; name: string; email: string }
interface WorkLog {
  id: number; content: string; logDate: string | number;
  projectId: number | null;
  project?: { id: number; name: string; key: string } | null;
  user?: { id: number; name: string; email: string } | null;
}

const SECTIONS = [
  { id: "issues_done", label: "Issues Completed" },
  { id: "issues_left", label: "Remaining Issues" },
  { id: "tasks",       label: "Tasks" },
  { id: "workspace",   label: "Workspace Items" },
  { id: "manual_log",  label: "Manual Log" },
] as const;
type SectionId = typeof SECTIONS[number]["id"];

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function todayIso() { return isoDate(new Date()); }
function parseLogDate(v: string | number) {
  return typeof v === "number" ? new Date(v * 1000) : new Date(v);
}

export default function WorkUpdatePage() {
  const { token, user } = useAuth();
  const isAdmin = (user as { role?: string } | null)?.role === "Admin";

  const [tab, setTab] = useState<"generate" | "log" | "calendar">("generate");
  const [projects, setProjects]               = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // generate tab
  const [genProject, setGenProject]   = useState("");
  const [genStart, setGenStart]       = useState(todayIso);
  const [genEnd, setGenEnd]           = useState("");
  const [sections, setSections]       = useState<SectionId[]>(["issues_done", "issues_left"]);
  const [members, setMembers]         = useState<MemberOption[]>([]);
  const [targetUser, setTargetUser]   = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [genLoading, setGenLoading]   = useState(false);
  const [genOutput, setGenOutput]     = useState("");
  const [genMeta, setGenMeta]         = useState<{ name: string; time: string } | null>(null);
  const [copied, setCopied]           = useState(false);

  // log tab — form
  const [logProject, setLogProject]   = useState("");
  const [logDate, setLogDate]         = useState(todayIso);
  const [logContent, setLogContent]   = useState("");
  const [logSaving, setLogSaving]     = useState(false);
  const [logRefining, setLogRefining] = useState(false);
  // log tab — list
  const [logs, setLogs]               = useState<WorkLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsCursor, setLogsCursor]   = useState<number | null>(null);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [editingLog, setEditingLog]   = useState<WorkLog | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editRefining, setEditRefining] = useState(false);
  // log tab — filters
  const [filterProject, setFilterProject] = useState("");
  const [filterStart, setFilterStart]     = useState("");
  const [filterEnd, setFilterEnd]         = useState("");
  const [filterUser, setFilterUser]       = useState("");
  const [allUsers, setAllUsers]           = useState<MemberOption[]>([]);
  const sentinelRef                       = useRef<HTMLDivElement>(null);

  // calendar tab
  const [calProject, setCalProject] = useState("");
  const [calMonth, setCalMonth]     = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calLogs, setCalLogs]   = useState<WorkLog[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calDay, setCalDay]     = useState<string | null>(null);

  // load projects
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setProjects((data.projects || data || []).map(
            (p: { id: number; name: string; key: string }) => ({ id: p.id, name: p.name, key: p.key })
          ));
        }
      } finally { setProjectsLoading(false); }
    })();
  }, [token]);

  // load all users for admin filter
  useEffect(() => {
    if (!isAdmin || !token) return;
    (async () => {
      const res = await fetch("/api/users?limit=200", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAllUsers((data.users || []).map((u: MemberOption) => ({ id: u.id, name: u.name, email: u.email })));
      }
    })();
  }, [isAdmin, token]);

  // load project members for generate tab (admin)
  useEffect(() => {
    if (!isAdmin || !genProject || !token) { setMembers([]); return; }
    (async () => {
      const res = await fetch(`/api/projects/${genProject}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMembers((data.project?.members || []).map(
          (pm: { user: MemberOption }) => pm.user
        ));
      }
    })();
  }, [isAdmin, genProject, token]);

  // load logs with cursor pagination
  const loadLogs = useCallback(async (cursor?: number | null, replace = false) => {
    if (!token) return;
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (filterProject) params.set("projectId", filterProject);
      if (filterStart)   params.set("start", filterStart);
      if (filterEnd)     params.set("end", filterEnd);
      if (isAdmin && filterUser) params.set("userId", filterUser);
      if (cursor)        params.set("cursor", String(cursor));
      const res = await fetch(`/api/work-logs?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setLogs(prev => replace ? (d.logs || []) : [...prev, ...(d.logs || [])]);
        setLogsCursor(d.nextCursor ?? null);
        setLogsHasMore(d.hasMore ?? false);
      }
    } finally { setLogsLoading(false); }
  }, [token, filterProject, filterStart, filterEnd, filterUser, isAdmin]);

  // reset on filter change or tab open
  useEffect(() => {
    if (tab !== "log") return;
    setLogs([]); setLogsCursor(null); loadLogs(null, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterProject, filterStart, filterEnd, filterUser]);

  // infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && logsHasMore && !logsLoading) loadLogs(logsCursor);
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [logsHasMore, logsLoading, logsCursor, loadLogs]);

  // load calendar logs
  const loadCalLogs = useCallback(async () => {
    if (!token) return;
    setCalLoading(true);
    try {
      const start = isoDate(new Date(calMonth.year, calMonth.month, 1));
      const end   = isoDate(new Date(calMonth.year, calMonth.month + 1, 0));
      const params = new URLSearchParams({ start, end, limit: "500" });
      if (calProject) params.set("projectId", calProject);
      const res = await fetch(`/api/work-logs?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setCalLogs(d.logs || []); }
    } finally { setCalLoading(false); }
  }, [token, calMonth, calProject]);

  useEffect(() => { if (tab === "calendar") loadCalLogs(); }, [tab, loadCalLogs]);

  // PLACEHOLDER_ACTIONS
  // generate
  const generate = useCallback(async () => {
    if (!genProject || !token || sections.length === 0) return;
    setGenLoading(true); setGenOutput("");
    try {
      const body: Record<string, unknown> = {
        projectId: Number(genProject), sections, startDate: genStart,
        endDate: genEnd || undefined,
      };
      if (isAdmin && targetUser) body.targetUserId = Number(targetUser);
      const res = await fetch("/api/ai/work-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setGenOutput(data.update);
      setGenMeta({
        name: data.targetUser?.name ?? "All",
        time: new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (e) {
      setGenOutput(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally { setGenLoading(false); }
  }, [genProject, sections, genStart, genEnd, isAdmin, targetUser, token]);

  const handleCopy = async () => {
    if (!genOutput) return;
    await navigator.clipboard.writeText(genOutput).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // save log
  const saveLog = async () => {
    if (!logContent.trim() || !token) return;
    setLogSaving(true);
    try {
      const res = await fetch("/api/work-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: logContent.trim(), logDate, projectId: logProject ? Number(logProject) : undefined }),
      });
      if (res.ok) { setLogContent(""); setLogs([]); setLogsCursor(null); loadLogs(null, true); }
    } finally { setLogSaving(false); }
  };

  const refineLog = async (content: string, setter: (v: string) => void, setRefining: (v: boolean) => void) => {
    if (!content.trim() || !token) return;
    setRefining(true);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, field: "work_log", mode: "refine" }),
      });
      const data = await res.json();
      if (res.ok && data.refinedContent) setter(data.refinedContent);
    } finally { setRefining(false); }
  };

  const deleteLog = async (id: number) => {
    if (!token) return;
    await fetch(`/api/work-logs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const saveEdit = async () => {
    if (!editingLog || !editContent.trim() || !token) return;
    const res = await fetch(`/api/work-logs/${editingLog.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: editContent.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setLogs(prev => prev.map(l => l.id === editingLog.id ? { ...l, content: data.log.content } : l));
      setEditingLog(null); setEditContent("");
    }
  };

  // calendar helpers
  const calDaysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const calFirstDay   = new Date(calMonth.year, calMonth.month, 1).getDay();
  const calLogsByDate = calLogs.reduce<Record<string, WorkLog[]>>((acc, l) => {
    const k = isoDate(parseLogDate(l.logDate));
    (acc[k] = acc[k] || []).push(l);
    return acc;
  }, {});
  const calDayLogs = calDay ? (calLogsByDate[calDay] || []) : [];
  const monthName  = new Date(calMonth.year, calMonth.month).toLocaleString("default", { month: "long", year: "numeric" });

  if (projectsLoading) return <><Header title="Work Update" hideSearch /><PageLoader /></>;

  const projOptions = projects.map(p => ({ value: String(p.id), label: `${p.key} · ${p.name}` }));
  const filteredMembers = members.filter(m =>
    !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <>
      <Header title="Work Update" hideSearch />
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["generate", "log", "calendar"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer",
                tab === t ? "border-b-2 border-accent text-accent" : "text-fg-muted hover:text-fg"
              )}>
              {t === "generate" ? "🤖 Generate" : t === "log" ? "📝 My Log" : "📅 Calendar"}
            </button>
          ))}
        </div>

        {/* ── GENERATE TAB ── */}
        {tab === "generate" && (
          <div className="space-y-4">
            <Card variant="default" className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select label="Project" value={genProject}
                  onChange={e => { setGenProject(e.target.value); setGenOutput(""); }}
                  options={projOptions} placeholder="Select project" searchable />
                <div>
                  <DatePicker label="From" value={genStart}
                    onChange={val => { setGenStart(val); setGenOutput(""); }} />
                </div>
                <div>
                  <DatePicker label="To (optional)" value={genEnd} min={genStart}
                    onChange={val => { setGenEnd(val); setGenOutput(""); }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-fg">Include sections</label>
                <div className="flex flex-wrap gap-2">
                  {SECTIONS.map(s => {
                    const active = sections.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => { setSections(prev => active ? prev.filter(x => x !== s.id) : [...prev, s.id]); setGenOutput(""); }}
                        className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                          active ? "bg-accent text-accent-fg border-accent" : "bg-surface text-fg-muted border-border hover:border-accent"
                        )}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isAdmin && genProject && members.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-fg">Generate for member</label>
                  <div className="relative">
                    <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search member by name or email..."
                      className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-accent" />
                    {memberSearch && (
                      <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredMembers.map(m => (
                          <button key={m.id} onClick={() => { setTargetUser(String(m.id)); setMemberSearch(m.name); }}
                            className={cn("w-full text-left px-3 py-2 text-sm hover:bg-bg-hover cursor-pointer",
                              targetUser === String(m.id) ? "bg-accent-subtle text-accent" : "text-fg"
                            )}>
                            {m.name} <span className="text-fg-subtle text-xs">{m.email}</span>
                          </button>
                        ))}
                        {filteredMembers.length === 0 && <p className="px-3 py-2 text-sm text-fg-muted">No match</p>}
                      </div>
                    )}
                  </div>
                  {targetUser && (
                    <button onClick={() => { setTargetUser(""); setMemberSearch(""); }}
                      className="text-xs text-fg-muted hover:text-fg flex items-center gap-1 cursor-pointer">
                      <X className="w-3 h-3" /> Clear (generate for all)
                    </button>
                  )}
                </div>
              )}

              <Button variant="primary" onClick={generate} loading={genLoading}
                disabled={!genProject || sections.length === 0 || genLoading}
                leftIcon={Sparkles} className="w-full sm:w-auto">
                {genLoading ? "Generating..." : "Generate Update"}
              </Button>
            </Card>

            {genOutput && (
              <Card variant="default" className="p-0 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-subtle">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="font-medium text-fg">
                      {genMeta?.name && genMeta.name !== "All" ? genMeta.name : projects.find(p => String(p.id) === genProject)?.name}
                    </span>
                    {genMeta?.time && <span className="text-fg-subtle text-xs">· {genMeta.time}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={generate} disabled={genLoading}
                      className="p-1.5 rounded-md hover:bg-bg-hover text-fg-muted transition-colors cursor-pointer">
                      <RefreshCw className={cn("w-3.5 h-3.5", genLoading && "animate-spin")} />
                    </button>
                    <button onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-accent-subtle text-accent hover:bg-accent hover:text-accent-fg transition-colors cursor-pointer">
                      {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><ClipboardCopy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <pre className="whitespace-pre-wrap text-sm text-fg leading-relaxed font-sans">{genOutput}</pre>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── LOG TAB ── */}
        {tab === "log" && (
          <div className="space-y-4">
            {/* Add form */}
            <Card variant="default" className="p-5 space-y-3">
              <h2 className="text-sm font-semibold text-fg">Add work entry</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <DatePicker label="Date" value={logDate} onChange={val => setLogDate(val)} />
                </div>
                <Select label="Project (optional)" value={logProject}
                  onChange={e => setLogProject(e.target.value)}
                  options={[{ value: "", label: "No project" }, ...projOptions]} />
              </div>
              <Textarea value={logContent} onChange={e => setLogContent(e.target.value)}
                placeholder="Describe what you worked on in plain language..." rows={4} />
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={saveLog} loading={logSaving}
                  disabled={!logContent.trim() || logSaving} leftIcon={Plus} size="sm">Save</Button>
                <Button variant="ghost" size="sm" leftIcon={Wand2} loading={logRefining}
                  disabled={!logContent.trim() || logRefining}
                  onClick={() => refineLog(logContent, setLogContent, setLogRefining)}>AI Refine</Button>
              </div>
            </Card>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-36">
                <DatePicker label="From" value={filterStart} onChange={val => setFilterStart(val)} />
              </div>
              <div className="w-36">
                <DatePicker label="To" value={filterEnd} min={filterStart} onChange={val => setFilterEnd(val)} />
              </div>
              <div className="space-y-1 min-w-[160px]">
                <label className="block text-xs font-medium text-fg-muted">Project</label>
                <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-accent">
                  <option value="">All projects</option>
                  {projects.map(p => <option key={p.id} value={String(p.id)}>{p.key} · {p.name}</option>)}
                </select>
              </div>
              {isAdmin && (
                <div className="space-y-1 min-w-[180px]">
                  <label className="block text-xs font-medium text-fg-muted">User</label>
                  <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-accent">
                    <option value="">All users</option>
                    {allUsers.map(u => <option key={u.id} value={String(u.id)}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
              )}
              {(filterStart || filterEnd || filterProject || filterUser) && (
                <button onClick={() => { setFilterStart(""); setFilterEnd(""); setFilterProject(""); setFilterUser(""); }}
                  className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg cursor-pointer mt-4">
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>

            {/* Log list */}
            <div className="space-y-2">
              {logs.length === 0 && !logsLoading && (
                <div className="text-sm text-fg-muted py-8 text-center">No logs found</div>
              )}
              {logs.map(log => (
                <Card key={log.id} variant="default" className="p-4">
                  {editingLog?.id === log.id ? (
                    <div className="space-y-2">
                      <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} />
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" onClick={saveEdit}>Save</Button>
                        <Button variant="ghost" size="sm" leftIcon={Wand2} loading={editRefining}
                          disabled={!editContent.trim() || editRefining}
                          onClick={() => refineLog(editContent, setEditContent, setEditRefining)}>AI Refine</Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditingLog(null); setEditContent(""); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-fg-muted">
                            {parseLogDate(log.logDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          {log.project && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-subtle text-accent">{log.project.key}</span>
                          )}
                          {isAdmin && log.user && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-bg-subtle text-fg-muted border border-border">
                              {log.user.name} · {log.user.email}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-fg whitespace-pre-wrap">{log.content}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditingLog(log); setEditContent(log.content); }}
                          className="p-1.5 rounded hover:bg-bg-hover text-fg-muted cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteLog(log.id)}
                          className="p-1.5 rounded hover:bg-bg-hover text-fg-muted hover:text-danger cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
              {/* infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-4" />
              {logsLoading && <div className="text-sm text-fg-muted text-center py-2">Loading...</div>}
              {!logsHasMore && logs.length > 0 && (
                <div className="text-xs text-fg-subtle text-center py-2">All entries loaded</div>
              )}
            </div>
          </div>
        )}

        {/* ── CALENDAR TAB ── */}
        {tab === "calendar" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                  className="p-1.5 rounded hover:bg-bg-hover cursor-pointer text-fg-muted"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-semibold text-fg w-36 text-center">{monthName}</span>
                <button onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                  className="p-1.5 rounded hover:bg-bg-hover cursor-pointer text-fg-muted"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <select value={calProject} onChange={e => setCalProject(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-accent">
                <option value="">All projects</option>
                {projects.map(p => <option key={p.id} value={String(p.id)}>{p.key} · {p.name}</option>)}
              </select>
            </div>

            {calLoading ? <div className="text-sm text-fg-muted py-8 text-center">Loading...</div> : (
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                    <div key={d} className="bg-bg-subtle px-2 py-1.5 text-xs font-medium text-fg-muted text-center">{d}</div>
                  ))}
                  {Array.from({ length: calFirstDay }).map((_, i) => (
                    <div key={`e${i}`} className="bg-surface min-h-[60px]" />
                  ))}
                  {Array.from({ length: calDaysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const key = isoDate(new Date(calMonth.year, calMonth.month, day));
                    const dayLogs = calLogsByDate[key] || [];
                    const isToday = key === todayIso();
                    return (
                      <button key={key} onClick={() => setCalDay(calDay === key ? null : key)}
                        className={cn("bg-surface min-h-[60px] p-1.5 text-left transition-colors cursor-pointer hover:bg-bg-hover",
                          calDay === key && "ring-2 ring-inset ring-accent")}>
                        <span className={cn("text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full",
                          isToday ? "bg-accent text-accent-fg" : "text-fg-muted")}>{day}</span>
                        {dayLogs.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {dayLogs.slice(0, 2).map(l => (
                              <div key={l.id} className="text-xs bg-accent-subtle text-accent rounded px-1 truncate">
                                {l.project?.key ?? "·"} {l.content.slice(0, 18)}
                              </div>
                            ))}
                            {dayLogs.length > 2 && <div className="text-xs text-fg-subtle">+{dayLogs.length - 2}</div>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {calDay && (
                  <Card variant="default" className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-fg">
                        {new Date(calDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                      </h3>
                      <button onClick={() => setCalDay(null)} className="text-fg-muted hover:text-fg cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                    {calDayLogs.length === 0 ? (
                      <p className="text-sm text-fg-muted">No logs for this day.</p>
                    ) : calDayLogs.map(l => (
                      <div key={l.id} className="border-l-2 border-accent pl-3 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {l.project && <span className="text-xs px-2 py-0.5 rounded-full bg-accent-subtle text-accent">{l.project.key} · {l.project.name}</span>}
                          {isAdmin && l.user && <span className="text-xs text-fg-muted">{l.user.name} · {l.user.email}</span>}
                        </div>
                        <p className="text-sm text-fg whitespace-pre-wrap">{l.content}</p>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
