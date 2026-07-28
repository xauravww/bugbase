"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { DatePicker } from "@/components/ui/DatePicker";

type Member = {
  user: { id: number; name: string; email?: string; role?: string };
  role: string;
  created: number;
  closed: number;
  comments: number;
  statusUpdates: number;
  activity: number;
};

type ActivityItem = {
  id: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { id: number; name: string; email?: string };
  issue: { id: number; title: string } | null;
};

type DailyPoint = {
  date: string;
  created: number;
  statusUpdates: number;
  comments: number;
  other: number;
  total: number;
};

type Response = {
  from: string;
  to: string;
  members: Member[];
  recentActivity: ActivityItem[];
  dailySeries: DailyPoint[];
  totals: { created: number; closed: number; comments: number; statusUpdates: number; activity: number };
  feed: { limit: number; offset: number; total: number; hasMore: boolean };
};

type Preset = "today" | "7d" | "30d" | "90d" | "custom";
const FEED_PAGE = 20;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const to = isoDate(now);
  if (p === "today") return { from: to, to };
  if (p === "7d") return { from: isoDate(new Date(now.getTime() - 6 * 86400000)), to };
  if (p === "30d") return { from: isoDate(new Date(now.getTime() - 29 * 86400000)), to };
  return { from: isoDate(new Date(now.getTime() - 89 * 86400000)), to };
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function actionLabel(a: ActivityItem): string {
  switch (a.action) {
    case "status_changed": return `set status → ${a.newValue || "?"}`;
    case "priority_changed": return `set priority → ${a.newValue || "?"}`;
    case "assignees_changed": return `updated assignees`;
    case "categories_changed": return `updated categories`;
    case "issue_created": return `created issue`;
    case "issue_updated": return `edited issue`;
    case "comment_added": return `commented`;
    default: return a.action.replace(/_/g, " ");
  }
}

function actionDot(a: ActivityItem): string {
  switch (a.action) {
    case "status_changed": return "#187574";
    case "comment_added": return "#9333ea";
    case "issue_created": return "#5b76fe";
    case "priority_changed": return "#f59e0b";
    default: return "#a5a8b5";
  }
}

// ---- Searchable member select ----
function MemberSelect({
  members,
  value,
  onChange,
}: {
  members: Member[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.user.name.toLowerCase().includes(q) || (m.user.email || "").toLowerCase().includes(q)
    );
  }, [members, query]);

  const selected = members.find((m) => m.user.id === value);

  return (
    <div ref={wrapRef} className="relative" style={{ minWidth: 220 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-1.5 text-xs rounded-md border bg-white flex items-center justify-between"
        style={{ borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
      >
        <span className="truncate">{selected ? selected.user.name : "All members"}</span>
        <span className="ml-2" style={{ color: "#a5a8b5" }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute z-30 mt-1 w-full rounded-md border bg-white shadow-lg"
          style={{ borderColor: "#e9eaef", maxHeight: 280, overflowY: "auto" }}
        >
          <div className="p-2 border-b" style={{ borderColor: "#f5f5f5" }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full px-2 py-1.5 text-xs rounded border"
              style={{ borderColor: "#e9eaef" }}
            />
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); setQuery(""); }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
            style={{ color: value === null ? "#5b76fe" : "#1c1c1e", fontWeight: value === null ? 600 : 400 }}
          >
            All members
          </button>
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs" style={{ color: "#a5a8b5" }}>No matches</div>
          ) : (
            filtered.map((m) => (
              <button
                key={m.user.id}
                type="button"
                onClick={() => { onChange(m.user.id); setOpen(false); setQuery(""); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
                style={{ fontFamily: "DM Sans, sans-serif" }}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs truncate" style={{ color: value === m.user.id ? "#5b76fe" : "#1c1c1e", fontWeight: value === m.user.id ? 600 : 500 }}>
                    {m.user.name}
                  </span>
                  {m.user.email && <span className="text-[10px] truncate" style={{ color: "#a5a8b5" }}>{m.user.email}</span>}
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: "#a5a8b5" }}>{m.activity} ev</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---- Stacked daily bar chart with Y axis ----
function DailyChart({ series }: { series: DailyPoint[] }) {
  const max = Math.max(1, ...series.map((d) => d.total));
  const yTicks = useMemo(() => {
    const step = Math.max(1, Math.ceil(max / 4));
    return [0, step, step * 2, step * 3, step * 4].filter((v) => v <= max + step);
  }, [max]);
  const chartHeight = 160;
  const segColors = {
    created: "#5b76fe",
    statusUpdates: "#187574",
    comments: "#9333ea",
    other: "#f59e0b",
  };

  return (
    <div className="flex gap-3" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div className="flex flex-col justify-between text-[10px] py-1" style={{ color: "#a5a8b5", height: chartHeight }}>
        {yTicks.slice().reverse().map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="flex-1">
        <div className="flex items-end gap-1 border-b" style={{ height: chartHeight, borderColor: "#e9eaef" }}>
          {series.map((d) => {
            const ratio = d.total === 0 ? 0 : d.total / max;
            const totalH = Math.max(d.total === 0 ? 0 : 2, Math.round(ratio * (chartHeight - 4)));
            const seg = (n: number) => (d.total === 0 ? 0 : Math.round((n / d.total) * totalH));
            const cH = seg(d.created);
            const sH = seg(d.statusUpdates);
            const mH = seg(d.comments);
            const oH = totalH - cH - sH - mH;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col-reverse"
                style={{ height: totalH }}
                title={`${d.date}\nCreated ${d.created}\nStatus updates ${d.statusUpdates}\nComments ${d.comments}\nOther ${d.other}\nTotal ${d.total}`}
              >
                {cH > 0 && <div style={{ height: cH, background: segColors.created }} />}
                {sH > 0 && <div style={{ height: sH, background: segColors.statusUpdates }} />}
                {mH > 0 && <div style={{ height: mH, background: segColors.comments }} />}
                {oH > 0 && <div style={{ height: oH, background: segColors.other }} />}
                {d.total === 0 && <div style={{ height: 2, background: "#e9eaef", borderRadius: 2 }} />}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-[10px]" style={{ color: "#a5a8b5" }}>
          {series.length > 0 && (
            <>
              <span>{series[0].date}</span>
              {series.length > 2 && <span>{series[Math.floor(series.length / 2)].date}</span>}
              <span>{series[series.length - 1].date}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-[11px]" style={{ color: "#555a6a" }}>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: segColors.created }} />Created</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: segColors.statusUpdates }} />Status updates</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: segColors.comments }} />Comments</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: segColors.other }} />Other</span>
        </div>
      </div>
    </div>
  );
}

export default function TeamProgress({ projectId }: { projectId: string }) {
  const { token } = useAuth();
  const [preset, setPreset] = useState<Preset>("7d");
  const [from, setFrom] = useState<string>(presetRange("7d").from);
  const [to, setTo] = useState<string>(presetRange("7d").to);
  const [userId, setUserId] = useState<number | null>(null);
  const [data, setData] = useState<Response | null>(null);
  const [feedItems, setFeedItems] = useState<ActivityItem[]>([]);
  const [feedTotal, setFeedTotal] = useState<number>(0);
  const [feedOffset, setFeedOffset] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (!token) return;
      const params = new URLSearchParams();
      params.set("from", new Date(`${from}T00:00:00`).toISOString());
      params.set("to", new Date(`${to}T23:59:59`).toISOString());
      params.set("limit", String(FEED_PAGE));
      params.set("offset", String(offset));
      if (userId) params.set("userId", String(userId));
      const res = await fetch(`/api/projects/${projectId}/team-progress?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to load");
      }
      const json: Response = await res.json();
      if (replace) {
        setData(json);
        setFeedItems(json.recentActivity);
      } else {
        setFeedItems((prev) => [...prev, ...json.recentActivity]);
      }
      setFeedTotal(json.feed.total);
      setFeedOffset(offset + json.recentActivity.length);
    },
    [from, projectId, to, token, userId]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await fetchPage(0, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    setError(null);
    try {
      await fetchPage(feedOffset, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsLoadingMore(false);
    }
  }, [feedOffset, fetchPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMembers = useMemo(() => {
    if (!data) return [];
    if (!userId) return data.members;
    return data.members.filter((m) => m.user.id === userId);
  }, [data, userId]);

  const setRangeFromPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {/* Filters bar */}
      <div className="rounded-2xl border p-4" style={{ borderColor: "#e9eaef", background: "#ffffff" }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "#f7f6f3" }}>
            {(["today", "7d", "30d", "90d", "custom"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setRangeFromPreset(p)}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                style={{
                  background: preset === p ? "#ffffff" : "transparent",
                  color: preset === p ? "#1c1c1e" : "#555a6a",
                  boxShadow: preset === p ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {p === "today" ? "Today" : p === "custom" ? "Custom" : p.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-36">
              <DatePicker
                value={from}
                max={to}
                onChange={(val) => { setPreset("custom"); setFrom(val); }}
              />
            </div>
            <span className="text-xs" style={{ color: "#a5a8b5" }}>→</span>
            <div className="w-36">
              <DatePicker
                value={to}
                min={from}
                onChange={(val) => { setPreset("custom"); setTo(val); }}
              />
            </div>
          </div>

          <MemberSelect members={data?.members || []} value={userId} onChange={setUserId} />

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="ml-auto px-3 py-1.5 text-xs font-medium rounded-md"
            style={{ background: "#5b76fe", color: "#ffffff" }}
          >
            {isLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mt-3 text-xs px-3 py-2 rounded-md" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Created", value: data?.totals.created ?? 0, color: "#5b76fe" },
          { label: "Status updates", value: data?.totals.statusUpdates ?? 0, color: "#187574" },
          { label: "Closed/Verified", value: data?.totals.closed ?? 0, color: "#0f766e" },
          { label: "Comments", value: data?.totals.comments ?? 0, color: "#9333ea" },
          { label: "Total events", value: data?.totals.activity ?? 0, color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border p-4" style={{ borderColor: "#e9eaef", background: "#ffffff" }}>
            <div className="text-xs uppercase tracking-wide" style={{ color: "#a5a8b5" }}>{s.label}</div>
            <div className="mt-1 text-2xl font-semibold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Daily activity chart */}
      <div className="rounded-2xl border p-4" style={{ borderColor: "#e9eaef", background: "#ffffff" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "#1c1c1e" }}>Daily activity</h3>
          <span className="text-xs" style={{ color: "#a5a8b5" }}>{from} → {to}</span>
        </div>
        {data && data.dailySeries.length > 0 ? (
          <DailyChart series={data.dailySeries} />
        ) : (
          <div className="text-xs text-center py-6" style={{ color: "#a5a8b5" }}>No activity in selected range</div>
        )}
      </div>

      {/* Per-member breakdown */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#e9eaef", background: "#ffffff" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#f5f5f5" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#1c1c1e" }}>Per-member breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a" }}>Member</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a" }}>Role</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a" }}>Created</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a" }}>Status updates</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a" }}>Closed</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a" }}>Comments</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a" }}>Total events</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs" style={{ color: "#a5a8b5" }}>No members</td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const inactive = m.activity === 0 && m.created === 0 && m.comments === 0;
                  return (
                    <tr key={m.user.id} className="border-b" style={{ borderColor: "#f5f5f5" }}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1c1c1e" }}>
                        <button
                          onClick={() => setUserId(userId === m.user.id ? null : m.user.id)}
                          className="hover:underline"
                          title="Click to filter feed"
                        >
                          {m.user.name}
                        </button>
                        {m.user.email && <div className="text-[11px]" style={{ color: "#a5a8b5" }}>{m.user.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#555a6a" }}>{m.role}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "#1c1c1e" }}>{m.created}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "#187574" }}>{m.statusUpdates}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "#0f766e" }}>{m.closed}</td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: "#9333ea" }}>{m.comments}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: "#1c1c1e" }}>{m.activity}</td>
                      <td className="px-4 py-3">
                        {inactive ? (
                          <span className="px-2 py-0.5 text-[11px] rounded-md" style={{ background: "#fff7ed", color: "#9a3412" }}>No activity</span>
                        ) : (
                          <span className="px-2 py-0.5 text-[11px] rounded-md" style={{ background: "#ecfdf5", color: "#065f46" }}>Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity feed */}
      <div className="rounded-2xl border" style={{ borderColor: "#e9eaef", background: "#ffffff" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#f5f5f5" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#1c1c1e" }}>
            Activity feed{userId ? " — filtered" : ""}{" "}
            <span className="text-xs font-normal" style={{ color: "#a5a8b5" }}>({feedItems.length} of {feedTotal})</span>
          </h3>
          {userId && (
            <button onClick={() => setUserId(null)} className="text-xs" style={{ color: "#5b76fe" }}>Clear filter</button>
          )}
        </div>
        <div className="divide-y" style={{ borderColor: "#f5f5f5" }}>
          {feedItems.length ? (
            feedItems.map((a) => (
              <div key={a.id} className="px-4 py-3 text-sm flex items-start gap-3" style={{ borderColor: "#f5f5f5" }}>
                <div className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0" style={{ background: actionDot(a) }} />
                <div className="flex-1 min-w-0">
                  <div style={{ color: "#1c1c1e" }}>
                    <span className="font-medium">{a.user.name}</span>{" "}
                    <span style={{ color: "#555a6a" }}>{actionLabel(a)}</span>
                    {a.issue && (
                      <>
                        {" "}on{" "}
                        <Link href={`/issues/${a.issue.id}`} className="font-medium hover:underline" style={{ color: "#5b76fe" }}>
                          #{a.issue.id} {a.issue.title}
                        </Link>
                      </>
                    )}
                  </div>
                  {a.action === "status_changed" && a.oldValue && (
                    <div className="text-[11px] mt-0.5" style={{ color: "#a5a8b5" }}>{a.oldValue} → {a.newValue}</div>
                  )}
                </div>
                <span className="text-[11px] flex-shrink-0" style={{ color: "#a5a8b5" }} title={new Date(a.createdAt).toLocaleString()}>{relativeTime(a.createdAt)}</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-xs" style={{ color: "#a5a8b5" }}>No activity</div>
          )}
        </div>
        {feedItems.length < feedTotal && (
          <div className="px-4 py-3 border-t flex justify-center" style={{ borderColor: "#f5f5f5" }}>
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="px-4 py-1.5 text-xs font-medium rounded-md"
              style={{ background: "#f7f6f3", color: "#1c1c1e", border: "1px solid #e9eaef" }}
            >
              {isLoadingMore ? "Loading…" : `Show more (${feedTotal - feedItems.length} left)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
