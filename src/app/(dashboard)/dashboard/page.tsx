"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bug, Lightbulb, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { Header } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge, TypeBadge, PriorityDot, Avatar, PageLoader } from "@/components/ui";

interface Stats {
  openBugs: number;
  openFeatures: number;
  inProgress: number;
  resolvedToday: number;
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

interface Activity {
  id: number;
  action: string;
  issueId: number;
  issueTitle: string;
  userName: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats>({ openBugs: 0, openFeatures: 0, inProgress: 0, resolvedToday: 0 });
  const [recentIssues, setRecentIssues] = useState<RecentIssue[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch("/api/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setRecentIssues(data.recentIssues || []);
          setActivities(data.recentActivities || []);
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
  }, [token]);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div>
      <Header title="Dashboard" />

      <div className="p-4 md:p-6 max-w-[1100px]">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard
            icon={Bug}
            label="Open Bugs"
            value={stats.openBugs}
            color="var(--color-danger)"
          />
          <StatCard
            icon={Lightbulb}
            label="Open Features"
            value={stats.openFeatures}
            color="var(--color-accent)"
          />
          <StatCard
            icon={Clock}
            label="In Progress"
            value={stats.inProgress}
            color="var(--color-warning)"
          />
          <StatCard
            icon={CheckCircle}
            label="Resolved Today"
            value={stats.resolvedToday}
            color="var(--color-success)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Recent Activity */}
          <div className="bg-white border border-[var(--color-border)] rounded-lg">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">Recent Activity</h2>
            </div>
            <div className="p-3 md:p-4">
              {activities.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-6 md:py-8">
                  No recent activity
                </p>
              ) : (
                <ul className="space-y-3">
                  {activities.slice(0, 10).map((activity) => (
                    <li key={activity.id} className="flex items-start gap-2 md:gap-3 text-sm">
                      <Avatar name={activity.userName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--color-text-primary)]">
                          <span className="font-medium">{activity.userName}</span>{" "}
                          <span className="text-[var(--color-text-secondary)]">{activity.action}</span>{" "}
                          <Link href={`/issues/${activity.issueId}`} className="text-[var(--color-accent)] hover:underline">
                            #{activity.issueId}
                          </Link>
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {formatRelativeTime(activity.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* My Open Issues */}
          <div className="bg-white border border-[var(--color-border)] rounded-lg">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="font-semibold text-[var(--color-text-primary)]">My Open Issues</h2>
              <Link href="/issues" className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-3 md:p-4">
              {recentIssues.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-6 md:py-8">
                  No open issues assigned to you
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentIssues.slice(0, 5).map((issue) => (
                    <li key={issue.id}>
                      <Link
                        href={`/issues/${issue.id}`}
                        className="flex items-center gap-2 md:gap-3 p-2 -mx-2 rounded hover:bg-[var(--color-hover-bg)] transition-colors"
                      >
                        <PriorityDot priority={issue.priority} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {issue.title}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {issue.projectName} &middot; #{issue.id}
                          </p>
                        </div>
                        <TypeBadge type={issue.type} />
                        <StatusBadge status={issue.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
        </div>
      </div>
    </div>
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
