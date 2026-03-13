"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Calendar, Download, Check, ExternalLink } from "lucide-react";
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
  isVerified: boolean;
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
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [activeTab, setActiveTab] = useState<string>("all");
  const [paginationState, setPaginationState] = useState<Record<string, number>>({ all: 1, Open: 1, "In Progress": 1, "In Review": 1, Verified: 1, Closed: 1 });

  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [selectedIssueIds, setSelectedIssueIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");

  // Track the latest search term for fetching without causing re-render loops
  const searchRef = useRef(search);
  searchRef.current = search;

  const fetchIssues = useCallback(async (searchTerm: string, page: number, tab: string, type: string, priority: string) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      params.set("assignedToMe", "true");
      if (searchTerm) params.set("search", searchTerm);
      if (type !== "all") params.set("type", type);
      if (priority !== "all") params.set("priority", priority);

      if (tab !== "all") {
        params.set("status", tab);
      }

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
  }, [token]);

  // Main fetch effect - triggers when tab, pagination, or filters change
  useEffect(() => {
    if (token) {
      fetchIssues(searchRef.current, paginationState[activeTab], activeTab, filterType, filterPriority);
    }
  }, [token, activeTab, paginationState, filterType, filterPriority, fetchIssues]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      if (token) {
        setPaginationState(prev => ({ ...prev, [activeTab]: 1 }));
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, token, activeTab]);

  // Reset pagination to page 1 when filters change
  const handleFilterTypeChange = (value: string) => {
    setFilterType(value);
    setPaginationState(prev => ({ ...prev, [activeTab]: 1 }));
  };

  const handleFilterPriorityChange = (value: string) => {
    setFilterPriority(value);
    setPaginationState(prev => ({ ...prev, [activeTab]: 1 }));
  };

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
    if (filterPriority !== "all") params.set("priority", filterPriority);
    if (activeTab !== "all") {
      params.set("status", activeTab);
    }
    if (token) params.set("token", token);
    window.open(`/api/issues/export?${params.toString()}`, "_blank");
  };

  const handleStatusChange = async (issueId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: newStatus } : i));
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedIssueIds.length === 0) return;
    try {
      await Promise.all(
        selectedIssueIds.map(id =>
          fetch(`/api/issues/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: bulkStatus }),
          })
        )
      );
      setIssues(prev => prev.map(i => selectedIssueIds.includes(i.id) ? { ...i, status: bulkStatus } : i));
      setSelectedIssueIds([]);
      setBulkStatus("");
    } catch (error) {
      console.error("Failed to bulk update:", error);
    }
  };

  const toggleSelectIssue = (id: number) => {
    setSelectedIssueIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIssueIds.length === issues.length) {
      setSelectedIssueIds([]);
    } else {
      setSelectedIssueIds(issues.map(i => i.id));
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <Header title="My Issues" />

      <div className="p-4 max-w-[1100px]">
        <div className="mb-4 border-b border-[var(--color-border)]">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { key: "all", label: "All" },
              { key: "Open", label: "Open" },
              { key: "In Progress", label: "In Progress" },
              { key: "In Review", label: "In Review" },
              { key: "Verified", label: "Verified" },
              { key: "Closed", label: "Closed" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder="Search by title or issue number (e.g. #123)..."
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
            onChange={(e) => handleFilterTypeChange(e.target.value)}
            className="w-full sm:w-28 md:w-32"
          />
          <Select
            options={[{ value: "all", label: "All Priorities" }, ...Object.values(ISSUE_PRIORITIES).map((p) => ({ value: p, label: p }))]}
            value={filterPriority}
            onChange={(e) => handleFilterPriorityChange(e.target.value)}
            className="w-full sm:w-32 md:w-36"
          />
          <span className="text-sm text-[var(--color-text-secondary)] ml-auto text-right self-center">
            {pagination.total} issue{pagination.total !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Bulk status update bar */}
        {selectedIssueIds.length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-[var(--color-accent-light,#e8f0fb)] border border-[var(--color-accent)] rounded-lg">
            <span className="text-sm font-medium">{selectedIssueIds.length} selected</span>
            <Select
              options={[
                { value: "", label: "Change status to..." },
                ...Object.values(ISSUE_STATUSES).map(s => ({ value: s, label: s })),
              ]}
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="w-44"
            />
            <Button variant="primary" onClick={handleBulkStatusUpdate} disabled={!bulkStatus} className="text-sm">
              Update
            </Button>
            <button onClick={() => setSelectedIssueIds([])} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ml-auto">
              Clear
            </button>
          </div>
        )}

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
                  className="bg-white border border-[var(--color-border)] rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={selectedIssueIds.includes(issue.id)}
                          onChange={() => toggleSelectIssue(issue.id)}
                          className="w-4 h-4 rounded border-[var(--color-border)]"
                        />
                        <span className="text-xs font-mono text-[var(--color-text-secondary)]">#{issue.id}</span>
                        <TypeBadge type={issue.type} />
                      </div>
                      <h3 className="font-medium text-[var(--color-text-primary)] text-sm mb-2 truncate">{issue.title}</h3>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <select
                          value={issue.status}
                          onChange={(e) => { e.stopPropagation(); handleStatusChange(issue.id, e.target.value); }}
                          className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-white"
                        >
                          {Object.values(ISSUE_STATUSES).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        {issue.isVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs border border-green-200">
                            <Check className="w-3 h-3" />
                            Verified
                          </span>
                        )}
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
                      <button
                        onClick={() => window.open(`/issues/${issue.id}`, "_blank")}
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent-light,#e8f0fb)] rounded-md hover:opacity-80 transition-opacity"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open Issue
                      </button>
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
                  <th className="text-left px-3 md:px-4 py-3 w-10">
                    <input type="checkbox" checked={issues.length > 0 && selectedIssueIds.length === issues.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-[var(--color-border)]" />
                  </th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">ID</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Title</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden md:table-cell">Project</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Type</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden sm:table-cell">Status</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden lg:table-cell">Priority</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden xl:table-cell">Due</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden md:table-cell">Assignees</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-[var(--color-text-secondary)]">
                      No issues found
                    </td>
                  </tr>
                ) : (
                  issues.map((issue) => {
                    const dueInfo = formatDate(issue.dueDate);
                    return (
                      <tr key={issue.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)]">
                        <td className="px-3 md:px-4 py-3">
                          <input type="checkbox" checked={selectedIssueIds.includes(issue.id)} onChange={() => toggleSelectIssue(issue.id)} className="w-4 h-4 rounded border-[var(--color-border)]" />
                        </td>
                        <td className="px-3 md:px-4 py-3 text-sm font-mono text-[var(--color-text-secondary)]">#{issue.id}</td>
                        <td className="px-3 md:px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] max-w-[200px] truncate">{issue.title}</td>
                        <td className="px-3 md:px-4 py-3 text-sm text-[var(--color-text-secondary)] hidden md:table-cell">
                          <Link href={`/projects/${issue.project.id}`} className="hover:text-[var(--color-accent)]">{issue.project.name}</Link>
                        </td>
                        <td className="px-3 md:px-4 py-3"><TypeBadge type={issue.type} /></td>
                        <td className="px-3 md:px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <select
                              value={issue.status}
                              onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                              className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-white cursor-pointer"
                            >
                              {Object.values(ISSUE_STATUSES).map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            {issue.isVerified && (
                              <Check className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                        </td>
                        <td className="px-3 md:px-4 py-3 hidden lg:table-cell"><div className="flex items-center gap-2"><PriorityDot priority={issue.priority} /><span className="text-sm">{issue.priority}</span></div></td>
                        <td className="px-3 md:px-4 py-3 hidden xl:table-cell">
                          {dueInfo && <span className={`text-xs ${dueInfo.isOverdue && issue.status !== "Verified" && issue.status !== "Closed" ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]"}`}>{dueInfo.date}</span>}
                        </td>
                        <td className="px-3 md:px-4 py-3 hidden md:table-cell">
                          {issue.assignees.length > 0 ? <AvatarGroup names={issue.assignees.map((a) => a.user.name)} max={2} /> : <span className="text-xs text-[var(--color-text-placeholder)]">-</span>}
                        </td>
                        <td className="px-3 md:px-4 py-3">
                          <button
                            onClick={() => window.open(`/issues/${issue.id}`, "_blank")}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent-light,#e8f0fb)] rounded-md hover:opacity-80 transition-opacity"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open
                          </button>
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
              Showing {((paginationState[activeTab] - 1) * pagination.limit) + 1} to {Math.min(paginationState[activeTab] * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginationState(prev => ({ ...prev, [activeTab]: prev[activeTab] - 1 }))}
                disabled={paginationState[activeTab] === 1}
                className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed touch-target"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">Page {paginationState[activeTab]} of {pagination.totalPages}</span>
              <button
                onClick={() => setPaginationState(prev => ({ ...prev, [activeTab]: prev[activeTab] + 1 }))}
                disabled={paginationState[activeTab] >= pagination.totalPages}
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
