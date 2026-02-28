"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Calendar, Download } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Select, PageLoader, StatusBadge, TypeBadge, PriorityDot, AvatarGroup } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_TYPES } from "@/constants";

interface Issue {
  id: number;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  updatedAt: string;
  project: { id: number; name: string; key: string };
  assignees: Array<{ user: { id: number; name: string } }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MyIssuesPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const fetchIssues = useCallback(async (searchTerm: string = "", page: number = 1) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      params.set("assignedToMe", "true");
      if (searchTerm) params.set("search", searchTerm);
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPriority !== "all") params.set("priority", filterPriority);

      const res = await fetch(`/api/issues?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch issues:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token, filterType, filterStatus, filterPriority]);

  useEffect(() => {
    if (token) {
      fetchIssues(search, pagination.page);
    }
  }, [token, pagination.page]);

  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const timer = setTimeout(() => {
      if (token) {
        fetchIssues(search, 1);
        setPagination(p => ({ ...p, page: 1 }));
      }
    }, 300);
    setSearchTimeout(timer);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (token) {
      fetchIssues(search, 1);
      setPagination(p => ({ ...p, page: 1 }));
    }
  }, [filterType, filterStatus, filterPriority]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const isOverdue = date < now;
    return { date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), isOverdue };
  };

  const handleExportPdf = () => {
    const params = new URLSearchParams();
    params.set("assignedToMe", "true");
    if (search) params.set("search", search);
    if (filterType !== "all") params.set("type", filterType);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPriority !== "all") params.set("priority", filterPriority);
    if (token) params.set("token", token);
    window.open(`/api/issues/export?${params.toString()}`, "_blank");
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <Header title="My Issues" />

      <div className="p-4 max-w-[1100px]">
        <div className="flex flex-col gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder="Search issues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <Button
            variant="secondary"
            onClick={handleExportPdf}
            className="flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="mobile-hidden">Export PDF</span>
            <span className="desktop-hidden">Export</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Select 
            options={[{ value: "all", label: "All Types" }, ...Object.values(ISSUE_TYPES).map((t) => ({ value: t, label: t }))]}
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)} 
            className="w-full sm:w-28 md:w-32" 
          />
          <Select 
            options={[{ value: "all", label: "All Statuses" }, ...Object.values(ISSUE_STATUSES).map((s) => ({ value: s, label: s }))]}
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)} 
            className="w-full sm:w-32 md:w-36" 
          />
          <Select 
            options={[{ value: "all", label: "All Priorities" }, ...Object.values(ISSUE_PRIORITIES).map((p) => ({ value: p, label: p }))]}
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)} 
            className="w-full sm:w-32 md:w-36" 
          />
          <span className="text-sm text-[var(--color-text-secondary)] ml-auto text-right self-center">
            {pagination.total} issue{pagination.total !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Mobile-friendly issue list */}
        <div className="md:hidden space-y-3 mb-4">
          {issues.length === 0 ? (
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-8 text-center">
              <p className="text-[var(--color-text-secondary)]">No issues found</p>
            </div>
          ) : (
            issues.map((issue) => {
              const dueInfo = formatDate(issue.dueDate);
              return (
                <div 
                  key={issue.id} 
                  className="bg-white border border-[var(--color-border)] rounded-lg p-4 cursor-pointer"
                  onClick={() => router.push(`/issues/${issue.id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-[var(--color-text-secondary)]">#{issue.id}</span>
                        <TypeBadge type={issue.type} />
                      </div>
                      <h3 className="font-medium text-[var(--color-text-primary)] text-sm mb-2 truncate">{issue.title}</h3>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <StatusBadge status={issue.status} />
                        <div className="flex items-center gap-1">
                          <PriorityDot priority={issue.priority} />
                          <span className="text-xs">{issue.priority}</span>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        <div>Project: {issue.project.name}</div>
                        {issue.assignees.length > 0 && (
                          <div className="mt-1">
                            Assignees: {issue.assignees.map(a => a.user.name).join(", ")}
                          </div>
                        )}
                        {dueInfo && (
                          <div className={`mt-1 ${dueInfo.isOverdue && issue.status !== "Verified" && issue.status !== "Closed" ? "text-[var(--color-danger)]" : ""}`}>
                            Due: {dueInfo.date}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">ID</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Title</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden md:table-cell">Project</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Type</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden sm:table-cell">Status</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden lg:table-cell">Priority</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden xl:table-cell">Due</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden md:table-cell">Assignees</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[var(--color-text-secondary)]">
                      No issues found
                    </td>
                  </tr>
                ) : (
                  issues.map((issue) => {
                    const dueInfo = formatDate(issue.dueDate);
                    return (
                      <tr key={issue.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] cursor-pointer"
                        onClick={() => router.push(`/issues/${issue.id}`)}>
                        <td className="px-3 md:px-4 py-3 text-sm font-mono text-[var(--color-text-secondary)]">#{issue.id}</td>
                        <td className="px-3 md:px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] max-w-[200px] truncate">{issue.title}</td>
                        <td className="px-3 md:px-4 py-3 text-sm text-[var(--color-text-secondary)] hidden md:table-cell">
                          <Link href={`/projects/${issue.project.id}`} className="hover:text-[var(--color-accent)]" onClick={(e) => e.stopPropagation()}>{issue.project.name}</Link>
                        </td>
                        <td className="px-3 md:px-4 py-3"><TypeBadge type={issue.type} /></td>
                        <td className="px-3 md:px-4 py-3 hidden sm:table-cell"><StatusBadge status={issue.status} /></td>
                        <td className="px-3 md:px-4 py-3 hidden lg:table-cell"><div className="flex items-center gap-2"><PriorityDot priority={issue.priority} /><span className="text-sm">{issue.priority}</span></div></td>
                        <td className="px-3 md:px-4 py-3 hidden xl:table-cell">
                          {dueInfo && <span className={`text-xs ${dueInfo.isOverdue && issue.status !== "Verified" && issue.status !== "Closed" ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]"}`}>{dueInfo.date}</span>}
                        </td>
                        <td className="px-3 md:px-4 py-3 hidden md:table-cell">
                          {issue.assignees.length > 0 ? <AvatarGroup names={issue.assignees.map((a) => a.user.name)} max={2} /> : <span className="text-xs text-[var(--color-text-placeholder)]">-</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} 
                disabled={pagination.page === 1}
                className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed touch-target"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">Page {pagination.page} of {pagination.totalPages}</span>
              <button 
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} 
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed touch-target"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
