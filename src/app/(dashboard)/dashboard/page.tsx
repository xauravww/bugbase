"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNumber } from "@/lib/utils/format";
import {
  Clock,
  CheckCircle,
  Eye,
  ShieldCheck,
  XCircle,
  Archive,
  ArrowRight,
  ArrowUpRight,
  CircleDot,
  Activity,
  Zap,
} from "lucide-react";
import { Header } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge, TypeBadge, PriorityDot, Avatar, PageLoader } from "@/components/ui";

interface Stats {
  open: number;
  inProgress: number;
  inReview: number;
  verified: number;
  closed: number;
  openToday: number;
  inProgressToday: number;
  inReviewToday: number;
  verifiedToday: number;
  closedToday: number;
}

interface RecentIssue {
  id: number;
  title: string;
  type: string;
  status: string;
  priority: string;
  projectName: string;
  updatedAt: string;
}

interface ActivityItem {
  id: number;
  action: string;
  issueId: number;
  issueTitle: string;
  userName: string;
  createdAt: string;
}

interface StatusChange {
  action: string;
  newValue: string | null;
  issueId: number;
  issueTitle: string;
  userName: string;
  createdAt: string;
}

const STATUS_ICON_MAP: Record<string, React.ElementType> = {
  "Open": CircleDot,
  "In Progress": Clock,
  "In Review": Eye,
  "Verified": ShieldCheck,
  "Closed": XCircle,
};

const STATUS_COLOR_MAP: Record<string, { bg: string; text: string; accent: string }> = {
  "Open": {
    bg: "var(--color-status-open-bg)",
    text: "var(--color-status-open-text)",
    accent: "#2e75cc",
  },
  "In Progress": {
    bg: "var(--color-status-progress-bg)",
    text: "var(--color-status-progress-text)",
    accent: "#d9730d",
  },
  "In Review": {
    bg: "var(--color-status-review-bg)",
    text: "var(--color-status-review-text)",
    accent: "#7b5ea7",
  },
  "Verified": {
    bg: "var(--color-status-verified-bg)",
    text: "var(--color-status-verified-text)",
    accent: "#1f8a4c",
  },
  "Closed": {
    bg: "var(--color-status-closed-bg)",
    text: "var(--color-status-closed-text)",
    accent: "#787774",
  },
};

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats>({ 
    open: 0,
    inProgress: 0, 
    inReview: 0,
    verified: 0,
    closed: 0,
    openToday: 0,
    inProgressToday: 0,
    inReviewToday: 0,
    verifiedToday: 0,
    closedToday: 0,
  });
  const [timeFilter, setTimeFilter] = useState<"all" | "today">("all");
  const [recentIssues, setRecentIssues] = useState<RecentIssue[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [statusChanges, setStatusChanges] = useState<StatusChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch(`/api/dashboard?time=${timeFilter}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setRecentIssues(data.myRecentAssignments || data.recentIssues || []);
          setActivities(data.recentActivities || []);
          setStatusChanges(data.todayStatusChanges || []);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchDashboardData();
    }
  }, [token, timeFilter]);

  if (isLoading) {
    return <PageLoader />;
  }

  // Group status changes by status
  const groupedChanges = statusChanges.reduce<Record<string, StatusChange[]>>((acc, change) => {
    const status = change.newValue || "Unknown";
    if (!acc[status]) acc[status] = [];
    acc[status].push(change);
    return acc;
  }, {});

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #fafaf9 0%, #f5f3f0 100%)" }}>
      <Header title="Dashboard" />

      <div className="px-4 py-5 md:px-8 md:py-7 max-w-[1200px] mx-auto">

        {/* === Time Filter === */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "#f0eeeb", width: "fit-content" }}>
          <button
            onClick={() => setTimeFilter("all")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${timeFilter === "all" ? "shadow-sm" : ""}`}
            style={timeFilter === "all" 
              ? { background: "#ffffff", color: "#1c1c1e" } 
              : { color: "#555a6a" }}
          >
            All Time
          </button>
          <button
            onClick={() => setTimeFilter("today")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${timeFilter === "today" ? "shadow-sm" : ""}`}
            style={timeFilter === "today" 
              ? { background: "#ffffff", color: "#1c1c1e" } 
              : { color: "#555a6a" }}
          >
            Today
          </button>
        </div>

        {/* === Hero Stats Row === */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <HeroStat
            icon={CircleDot}
            label={timeFilter === "today" ? "Open Today" : "Open"}
            value={timeFilter === "today" ? stats.openToday : stats.open}
            color="#2e75cc"
            bgGradient="linear-gradient(135deg, #f0f7ff 0%, #e1edfa 100%)"
          />
          <HeroStat
            icon={Clock}
            label={timeFilter === "today" ? "In Progress Today" : "In Progress"}
            value={timeFilter === "today" ? stats.inProgressToday : stats.inProgress}
            color="#d9730d"
            bgGradient="linear-gradient(135deg, #fff8f0 0%, #fef0e1 100%)"
          />
          <HeroStat
            icon={Eye}
            label={timeFilter === "today" ? "In Review Today" : "In Review"}
            value={timeFilter === "today" ? stats.inReviewToday : stats.inReview}
            color="#8e44ad"
            bgGradient="linear-gradient(135deg, #f5f0ff 0%, #ede5fa 100%)"
          />
          <HeroStat
            icon={ShieldCheck}
            label={timeFilter === "today" ? "Verified Today" : "Verified"}
            value={timeFilter === "today" ? stats.verifiedToday : stats.verified}
            color="#1abc9c"
            bgGradient="linear-gradient(135deg, #f0fffa 0%, #e3f9f2 100%)"
          />
          <HeroStat
            icon={Archive}
            label={timeFilter === "today" ? "Closed Today" : "Closed"}
            value={timeFilter === "today" ? stats.closedToday : stats.closed}
            color="#787774"
            bgGradient="linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)"
          />
        </div>

        {/* === Today's Status Changes === */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #333 100%)" }}
            >
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--color-text-secondary)", letterSpacing: "0.08em" }}>
              Today&apos;s Movement
            </h2>
          </div>

          {Object.keys(groupedChanges).length === 0 ? (
            <div
              className="rounded-xl border px-5 py-8 text-center"
              style={{
                borderColor: "var(--color-border)",
                background: "rgba(255,255,255,0.7)",
                backdropFilter: "blur(8px)",
              }}
            >
              <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-text-placeholder)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                No status changes today yet
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(groupedChanges).map(([status, changes]) => {
                const colors = STATUS_COLOR_MAP[status] || STATUS_COLOR_MAP["Open"];
                const Icon = STATUS_ICON_MAP[status] || CircleDot;
                return (
                  <StatusChangeCard
                    key={status}
                    status={status}
                    changes={changes}
                    colors={colors}
                    icon={Icon}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* === Bottom Grid: Activity + My Issues === */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Recent Activity — takes 3 cols */}
          <div
            className="lg:col-span-3 rounded-xl border overflow-hidden"
            style={{
              borderColor: "var(--color-border)",
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="px-5 py-3.5 flex items-center gap-2 border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              <Activity className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
              <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-secondary)", letterSpacing: "0.06em" }}>
                Recent Activity
              </h2>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {activities.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--color-text-secondary)" }}>
                  No recent activity
                </p>
              ) : (
                <div className="space-y-1">
                  {activities.slice(0, 12).map((activity, idx) => (
                    <ActivityRow key={activity.id} activity={activity} isLast={idx === Math.min(11, activities.length - 1)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* My Open Issues — takes 2 cols */}
          <div
            className="lg:col-span-2 rounded-xl border overflow-hidden"
            style={{
              borderColor: "var(--color-border)",
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="px-5 py-3.5 flex items-center justify-between border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-secondary)", letterSpacing: "0.06em" }}>
                My Open Issues
              </h2>
              <Link
                href="/issues"
                className="text-xs font-medium flex items-center gap-1 hover:gap-1.5 transition-all"
                style={{ color: "var(--color-accent)" }}
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-3 max-h-[400px] overflow-y-auto">
              {recentIssues.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-success)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>All clear</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>No open issues assigned to you</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentIssues.slice(0, 8).map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ——— Sub-components ——— */

function HeroStat({
  icon: Icon,
  label,
  value,
  color,
  bgGradient,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bgGradient: string;
}) {
  return (
    <div
      className="relative rounded-xl border px-4 py-4 md:px-5 md:py-5 overflow-hidden group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{
        background: bgGradient,
        borderColor: `${color}20`,
      }}
    >
      {/* Decorative circle */}
      <div
        className="absolute -right-3 -top-3 w-16 h-16 rounded-full opacity-[0.07]"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p
            className="text-3xl md:text-4xl font-bold tracking-tight leading-none"
            style={{ color }}
          >
            {formatNumber(value)}
          </p>
          <p className="text-xs md:text-[13px] font-medium mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
            {label}
          </p>
        </div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15` }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function StatusChangeCard({
  status,
  changes,
  colors,
  icon: Icon,
}: {
  status: string;
  changes: StatusChange[];
  colors: { bg: string; text: string; accent: string };
  icon: React.ElementType;
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-md"
      style={{
        borderColor: `${colors.accent}25`,
        background: `linear-gradient(135deg, ${colors.bg} 0%, white 100%)`,
      }}
    >
      {/* Card header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${colors.accent}15` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: colors.accent }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.accent, letterSpacing: "0.05em" }}>
              {status}
            </p>
          </div>
        </div>
        <span
          className="text-lg font-bold tabular-nums"
          style={{ color: colors.accent }}
        >
          {changes.length}
        </span>
      </div>

      {/* Change items */}
      <div className="px-4 pb-3 space-y-2">
        {changes.slice(0, 3).map((change, i) => (
          <Link
            key={`${change.issueId}-${i}`}
            href={`/issues/${change.issueId}`}
            className="flex items-start gap-2 group/item"
          >
            <ArrowUpRight
              className="w-3 h-3 mt-0.5 shrink-0 opacity-40 group-hover/item:opacity-100 transition-opacity"
              style={{ color: colors.accent }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate group-hover/item:underline" style={{ color: "var(--color-text-primary)" }}>
                #{change.issueId} {change.issueTitle}
              </p>
              <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                {change.userName} &middot; {formatRelativeTime(change.createdAt)}
              </p>
            </div>
          </Link>
        ))}
        {changes.length > 3 && (
          <p className="text-[11px] font-medium pl-5" style={{ color: colors.accent }}>
            +{changes.length - 3} more
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ activity, isLast }: { activity: ActivityItem; isLast: boolean }) {
  return (
    <div
      className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-black/[0.02] transition-colors"
      style={{ borderBottom: isLast ? "none" : "1px solid var(--color-border)" }}
    >
      <Avatar name={activity.userName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-snug">
          <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{activity.userName}</span>
          {" "}
          <span style={{ color: "var(--color-text-secondary)" }}>{activity.action}</span>
          {" "}
          <Link
            href={`/issues/${activity.issueId}`}
            className="font-medium hover:underline"
            style={{ color: "var(--color-accent)" }}
          >
            #{activity.issueId}
          </Link>
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-placeholder)" }}>
          {formatRelativeTime(activity.createdAt)}
        </p>
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: RecentIssue }) {
  return (
    <Link
      href={`/issues/${issue.id}`}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-black/[0.03] transition-colors group"
    >
      <PriorityDot priority={issue.priority} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate group-hover:underline" style={{ color: "var(--color-text-primary)" }}>
          {issue.title}
        </p>
        <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
          {issue.projectName} &middot; #{issue.id}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <TypeBadge type={issue.type} />
        <StatusBadge status={issue.status} />
      </div>
    </Link>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
