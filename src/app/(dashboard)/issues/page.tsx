"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Clipboard, Download, ExternalLink, Search } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Select, PageLoader, TypeBadge, PriorityDot, AvatarGroup } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_TYPES } from "@/constants";
import MultiSelectChips from "@/components/ui/MultiSelectChips";
import { contrastingText } from "@/lib/categories";

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
  categories?: Array<{ category: { id: number; name: string; color: string } }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MyIssuesPage() {
  const { token, user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [activeTab, setActiveTab] = useState<string>("all");
  const [paginationState, setPaginationState] = useState<Record<string, number>>({ all: 1, Open: 1, "In Progress": 1, "In Review": 1, Verified: 1, Closed: 1 });

  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const [filterCategoryIds, setFilterCategoryIds] = useState<number[]>([]);
  const [categoryMode, setCategoryMode] = useState<"any" | "all">("any");
  const [projectsList, setProjectsList] = useState<Array<{ id: number; name: string; key: string }>>([]);
  const [projectCategories, setProjectCategories] = useState<Array<{ id: number; name: string; color: string }>>([]);

  const [selectedIssueIds, setSelectedIssueIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [copiedIssues, setCopiedIssues] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const isAdmin = user?.role === "Admin";

  const fetchIssues = useCallback(async (
    searchTerm: string,
    page: number,
    tab: string,
    type: string,
    priority: string,
    projectId: string,
    categoryIds: number[],
    catMode: "any" | "all"
  ) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (!isAdmin) params.set("assignedToMe", "true");
      if (searchTerm) params.set("search", searchTerm);
      if (type !== "all") params.set("type", type);
      if (priority !== "all") params.set("priority", priority);
      if (projectId !== "all") params.set("projectId", projectId);
      if (categoryIds.length > 0) {
        params.set("categoryIds", categoryIds.join(","));
        params.set("categoryMode", catMode);
      }

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
  }, [isAdmin, token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProjectsList(data.projects || []);
        }
      } catch {}
    })();
  }, [token]);

  useEffect(() => {
    if (!token || filterProjectId === "all") {
      setProjectCategories([]);
      setFilterCategoryIds([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/projects/${filterProjectId}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProjectCategories(data.categories || []);
        }
      } catch {}
    })();
  }, [token, filterProjectId]);

  // Main fetch effect - triggers when tab, pagination, or filters change
  useEffect(() => {
    if (token) {
      fetchIssues(
        debouncedSearch,
        paginationState[activeTab],
        activeTab,
        filterType,
        filterPriority,
        filterProjectId,
        filterCategoryIds,
        categoryMode
      );
    }
  }, [token, activeTab, paginationState, filterType, filterPriority, filterProjectId, filterCategoryIds, categoryMode, debouncedSearch, fetchIssues]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPaginationState(prev => ({ ...prev, [activeTab]: 1 }));
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, activeTab]);

  // Reset pagination to page 1 when filters change
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const handleCreateCategory = async (name: string) => {
    if (!token || filterProjectId === "all") return null;
    setIsCreatingCategory(true);
    try {
      const res = await fetch(`/api/projects/${filterProjectId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const data = await res.json();
        setProjectCategories(prev => [...prev, data.category]);
        return data.category.id;
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to create category");
      }
    } catch (e) {
      console.error(e);
      alert("Error creating category");
    } finally {
      setIsCreatingCategory(false);
    }
    return null;
  };

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
    if (!isAdmin) params.set("assignedToMe", "true");
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterType !== "all") params.set("type", filterType);
    if (filterPriority !== "all") params.set("priority", filterPriority);
    if (activeTab !== "all") {
      params.set("status", activeTab);
    }
    if (token) params.set("token", token);
    window.open(`/api/issues/export?${params.toString()}`, "_blank");
  };

  const handleCopyIssues = async () => {
    if (issues.length === 0) return;
    setIsCopying(true);
    try {
      const lines: string[] = [];
      lines.push(`${isAdmin ? "All Issues" : "My Issues"}`);
      lines.push(`Filter: ${activeTab === "all" ? "All Statuses" : activeTab}`);
      lines.push(`Total: ${pagination.total} issues`);
      lines.push("===================================");
      lines.push("");

      issues.forEach((issue) => {
        lines.push(`#${issue.id}: ${issue.title}`);
        lines.push(`Project: ${issue.project.name} (${issue.project.key})`);
        lines.push(`Type: ${issue.type} | Status: ${issue.status} | Priority: ${issue.priority}`);
        if (issue.assignees.length > 0) {
          lines.push(`Assignees: ${issue.assignees.map(a => a.user.name).join(", ")}`);
        }
        if (issue.dueDate) lines.push(`Due: ${new Date(issue.dueDate).toLocaleDateString()}`);
        lines.push(`Updated: ${new Date(issue.updatedAt).toLocaleString()}`);
        lines.push("");
        lines.push("-----------------------------------");
        lines.push("");
      });

      const text = lines.join("\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedIssues(true);
      setTimeout(() => setCopiedIssues(false), 2000);
    } catch (error) {
      console.error("Failed to copy issues:", error);
    } finally {
      setIsCopying(false);
    }
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
    <div className="min-h-screen" style={{ background: "#ffffff" }}>
      <Header title={isAdmin ? "All Issues" : "My Issues"} />

      <div className="p-3 md:p-8 max-w-[1400px] mx-auto">
        <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-fg-muted">
          Bugs and feature requests are now managed separately in each project’s <Link href="/projects" className="font-medium text-accent hover:underline">Workspace</Link>. We shifted to the new Bugs and Features page, so please create new bugs and feature requests there. Issues remains available for existing issue reports.
        </div>
        <div className="overflow-x-auto pb-2 mb-4 md:mb-6 -mx-3 px-3 md:px-0">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "#f7f6f3", width: "fit-content", minWidth: "max-content" }}>
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
                className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all whitespace-nowrap"
                style={{
                  background: activeTab === tab.key ? "#ffffff" : "transparent",
                  color: activeTab === tab.key ? "#1c1c1e" : "#555a6a",
                  fontFamily: "DM Sans, sans-serif",
                  boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.key) e.currentTarget.style.background = "#e9e9e9";
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.key) e.currentTarget.style.background = "transparent";
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 mb-4 md:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#a5a8b5" }} />
            <input
              type="text"
              placeholder="Search by title or issue number (e.g. #123)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border transition-all focus:outline-none focus:border-[#5b76fe]"
              style={{ background: "#f7f6f3", borderColor: "transparent", fontFamily: "DM Sans, sans-serif" }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              options={[{ value: "all", label: "All Projects" }, ...projectsList.map((p) => ({ value: String(p.id), label: p.name }))]}
              value={filterProjectId}
              onChange={(e) => {
                setFilterProjectId(e.target.value);
                setPaginationState((prev) => ({ ...prev, [activeTab]: 1 }));
              }}
              className="w-44"
            />
            <Select
              options={[{ value: "all", label: "All Types" }, ...Object.values(ISSUE_TYPES).map((t) => ({ value: t, label: t }))]}
              value={filterType}
              onChange={(e) => handleFilterTypeChange(e.target.value)}
              className="w-36"
            />
            <Select
              options={[{ value: "all", label: "All Priorities" }, ...Object.values(ISSUE_PRIORITIES).map((p) => ({ value: p, label: p }))]}
              value={filterPriority}
              onChange={(e) => handleFilterPriorityChange(e.target.value)}
              className="w-40"
            />
            <Button
              variant="secondary"
              onClick={handleCopyIssues}
              className="flex items-center gap-2"
              style={{
                border: "1px solid #e9eaef",
                borderRadius: "8px",
                fontFamily: "DM Sans, sans-serif",
                padding: "8px 12px"
              }}
              disabled={issues.length === 0 || isCopying}
            >
              {copiedIssues ? <Check className="w-4 h-4" style={{ color: "#00b473" }} /> : <Clipboard className="w-4 h-4" />}
              <span>{isCopying ? "Copying..." : copiedIssues ? "Copied!" : "Copy"}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportPdf}
              className="flex items-center gap-2"
              style={{
                border: "1px solid #e9eaef",
                borderRadius: "8px",
                fontFamily: "DM Sans, sans-serif",
                padding: "8px 12px"
              }}
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </Button>
            <span className="text-sm whitespace-nowrap ml-auto lg:ml-2" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>
              {pagination.total} {pagination.total === 1 ? "issue" : "issues"}
            </span>
          </div>

          {filterProjectId !== "all" && projectCategories.length > 0 && (
            <div className="flex flex-wrap items-end gap-2 mt-2">
              <div className="flex-1 min-w-[260px]">
                <MultiSelectChips
                  label="Categories"
                  options={projectCategories.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
                  value={filterCategoryIds}
                  onChange={(ids) => {
                    setFilterCategoryIds(ids);
                    setPaginationState((prev) => ({ ...prev, [activeTab]: 1 }));
                  }}
                  placeholder="Filter by categories"
                  onCreateOption={async (name) => {
                    const id = await handleCreateCategory(name);
                    if (id) {
                      setFilterCategoryIds([...filterCategoryIds, id]);
                      setPaginationState((prev) => ({ ...prev, [activeTab]: 1 }));
                    }
                  }}
                  isCreating={isCreatingCategory}
                />
              </div>
              {filterCategoryIds.length > 1 && (
                <div className="flex p-1 rounded-lg" style={{ background: "#f7f6f3" }}>
                  <button
                    type="button"
                    onClick={() => setCategoryMode("any")}
                    className="px-3 py-1.5 text-xs font-medium rounded-md"
                    style={{
                      background: categoryMode === "any" ? "#ffffff" : "transparent",
                      color: categoryMode === "any" ? "#1c1c1e" : "#555a6a",
                      boxShadow: categoryMode === "any" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    Match ANY
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryMode("all")}
                    className="px-3 py-1.5 text-xs font-medium rounded-md"
                    style={{
                      background: categoryMode === "all" ? "#ffffff" : "transparent",
                      color: categoryMode === "all" ? "#1c1c1e" : "#555a6a",
                      boxShadow: categoryMode === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    Match ALL
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bulk status update bar */}
        {selectedIssueIds.length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: "#c3faf5", border: "1px solid #5b76fe" }}>
            <span className="text-sm font-medium" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>{selectedIssueIds.length} selected</span>
            <Select
              options={[
                { value: "", label: "Change status to..." },
                ...Object.values(ISSUE_STATUSES).map(s => ({ value: s, label: s })),
              ]}
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="w-44"
            />
            <Button variant="primary" onClick={handleBulkStatusUpdate} disabled={!bulkStatus} className="text-sm" style={{ background: "#5b76fe", borderRadius: "8px" }}>
              Update
            </Button>
            <button onClick={() => setSelectedIssueIds([])} className="text-sm ml-auto hover:opacity-80" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
              Clear
            </button>
          </div>
        )}

        {/* Mobile-friendly issue list */}
        <div className="md:hidden space-y-3 mb-4">
          {issues.length === 0 ? (
            <div className="bg-white border rounded-lg p-8 text-center" style={{ borderColor: "#e9eaef" }}>
              <p style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>No issues found</p>
            </div>
          ) : (
            issues.map((issue) => {
              const dueInfo = formatDate(issue.dueDate);
              return (
                <div
                  key={issue.id}
                  className="bg-white border rounded-lg p-4"
                  style={{ borderColor: "#e9eaef" }}
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
                        {issue.categories && issue.categories.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {issue.categories.map(({ category }) => (
                              <span key={category.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: category.color, color: contrastingText(category.color) }}>
                                {category.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {dueInfo && (
                          <div className={`mt-1 ${dueInfo.isOverdue && issue.status !== "Closed" ? "text-[var(--color-danger)]" : ""}`}>
                            Due: {dueInfo.date}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => window.open(`/issues/${issue.id}`, "_blank")}
                        className="mt-2 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md hover:opacity-80 transition-opacity"
                        style={{ background: "#c3faf5", color: "#187574", fontFamily: "DM Sans, sans-serif" }}
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
        <div className="hidden md:block rounded-2xl border overflow-hidden" style={{ borderColor: "#e9eaef", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th className="text-left px-3 md:px-4 py-3 w-10">
                    <input type="checkbox" checked={issues.length > 0 && selectedIssueIds.length === issues.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-[var(--color-border)]" />
                  </th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>ID</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Title</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Project</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Type</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Status</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Priority</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden xl:table-cell" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Due</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Assignees</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold uppercase tracking-wide w-20" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>
                      No issues found
                    </td>
                  </tr>
                ) : (
                  issues.map((issue) => {
                    const dueInfo = formatDate(issue.dueDate);
                    return (
                      <tr key={issue.id} className="border-b transition-colors hover:bg-gray-50" style={{ borderColor: "#f5f5f5" }}>
                        <td className="px-3 md:px-4 py-3">
                          <input type="checkbox" checked={selectedIssueIds.includes(issue.id)} onChange={() => toggleSelectIssue(issue.id)} className="w-4 h-4 rounded border-[var(--color-border)]" />
                        </td>
                        <td className="px-3 md:px-4 py-3 text-sm font-mono" style={{ color: "#a5a8b5" }}>#{issue.id}</td>
                        <td className="px-3 md:px-4 py-3 text-sm font-medium max-w-[260px]" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                          <div className="flex flex-col gap-1">
                            <span className="truncate">{issue.title}</span>
                            {issue.categories && issue.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {issue.categories.map(({ category }) => (
                                  <span key={category.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                    style={{ backgroundColor: category.color, color: contrastingText(category.color) }}>
                                    {category.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 md:px-4 py-3 text-sm text-[var(--color-text-secondary)] hidden md:table-cell">
                          <Link href={`/projects/${issue.project.id}`} className="hover:text-[var(--color-accent)]">{issue.project.name}</Link>
                        </td>
                        <td className="px-3 md:px-4 py-3"><TypeBadge type={issue.type} /></td>
                        <td className="px-3 md:px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <select
                              value={issue.status}
                              onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                              className="text-sm px-3 py-2 rounded-lg border cursor-pointer bg-white"
                              style={{ borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
                            >
                              {Object.values(ISSUE_STATUSES).map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 md:px-4 py-3 hidden lg:table-cell"><div className="flex items-center gap-2"><PriorityDot priority={issue.priority} /><span className="text-sm">{issue.priority}</span></div></td>
                        <td className="px-3 md:px-4 py-3 hidden xl:table-cell">
                          {dueInfo && <span className={`text-xs ${dueInfo.isOverdue && issue.status !== "Closed" ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]"}`}>{dueInfo.date}</span>}
                        </td>
                        <td className="px-3 md:px-4 py-3 hidden md:table-cell">
                          {issue.assignees.length > 0 ? <AvatarGroup names={issue.assignees.map((a) => a.user.name)} max={2} /> : <span className="text-xs text-[var(--color-text-placeholder)]">-</span>}
                        </td>
                        <td className="px-3 md:px-4 py-3">
                          <button
                            onClick={() => window.open(`/issues/${issue.id}`, "_blank")}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md hover:opacity-80 transition-opacity"
                            style={{ background: "#c3faf5", color: "#187574", fontFamily: "DM Sans, sans-serif" }}
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
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4 px-1">
            <span className="text-[13px] text-[var(--color-text-secondary)]">
              Showing {((paginationState[activeTab] - 1) * pagination.limit) + 1} to {Math.min(paginationState[activeTab] * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginationState(prev => ({ ...prev, [activeTab]: prev[activeTab] - 1 }))}
                disabled={paginationState[activeTab] === 1}
                className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[13px] text-[var(--color-text-secondary)] tabular-nums">Page {paginationState[activeTab]} of {pagination.totalPages}</span>
              <button
                onClick={() => setPaginationState(prev => ({ ...prev, [activeTab]: prev[activeTab] + 1 }))}
                disabled={paginationState[activeTab] >= pagination.totalPages}
                className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-all"
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
