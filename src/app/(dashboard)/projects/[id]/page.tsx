"use client";

import { useCallback, useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, List, LayoutGrid, ChevronLeft, ChevronRight, Image, X, Download, Sparkles, Wand2, Clipboard, Check, ExternalLink, RefreshCw } from "lucide-react";
import { Button, Modal, Input, Select, PageLoader, StatusBadge, TypeBadge, PriorityDot, AvatarGroup, FabButton, Checkbox } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_TYPES } from "@/constants";
import type { Pagination } from "@/types/issue";

import { MarkdownEditor } from "@/components/pm/MarkdownEditor";
import { ListsWorkspace } from "@/components/lists/ListsWorkspace";
import { ProjectWorkspacePanel } from "@/components/pm/ProjectWorkspacePanel";
import CategoriesManager from "@/components/projects/CategoriesManager";
import TeamProgress from "@/components/projects/TeamProgress";
import MultiSelectChips from "@/components/ui/MultiSelectChips";
import { contrastingText } from "@/lib/categories";
import { cn } from "@/lib/utils/cn";

interface Issue {
  id: number;
  title: string;
  type: string;
  status: string;
  priority: string;
  reporterId: number;
  createdAt?: string;
  updatedAt: string;
  reporter?: { id: number; name: string; email?: string };
  assignees: Array<{ user: { id: number; name: string } }>;
  categories?: Array<{ category: { id: number; name: string; color: string } }>;
}

interface Project {
  id: number;
  name: string;
  key: string;
  description: string | null;
  members: Array<{ user: { id: number; name: string; email: string }; role: string }>;
  todayActivity?: {
    created: number;
    updated: number;
    actors: string[];
  };
}

function formatActivity(iso?: string): { label: string; isToday: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  let label: string;
  if (diffMin < 1) label = "just now";
  else if (diffMin < 60) label = `${diffMin}m ago`;
  else if (diffHr < 24 && sameDay) label = `${diffHr}h ago`;
  else if (diffDay < 7) label = `${diffDay}d ago`;
  else label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { label, isToday: sameDay };
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user } = useAuth();
  const initialTab = (() => {
    const t = searchParams.get("tab");
    if (t === "tasks") return "tasks";
    if (t === "workspace") return "workspace";
    if (t === "team") return "team";
    if (t === "settings") return "settings";
    return "issues";
  })() as "issues" | "tasks" | "workspace" | "team" | "settings";
  const initialStatus = searchParams.get("status") ?? "all";
  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesPagination, setIssuesPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [activeTab, setActiveTab] = useState<"issues" | "tasks" | "workspace" | "team" | "settings">(initialTab);
  const [issueStatusTab, setIssueStatusTab] = useState<string>(initialStatus);
  const [issuesPaginationState, setIssuesPaginationState] = useState<Record<string, number>>({ all: 1, Open: 1, "In Progress": 1, "In Review": 1, Closed: 1 });
  const [selectedProjectIssueIds, setSelectedProjectIssueIds] = useState<number[]>([]);
  const [bulkProjectStatus, setBulkProjectStatus] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: "",
    type: "Bug",
    description: "",
    stepsToReproduce: "",
    expectedResult: "",
    actualResult: "",
    priority: "Medium",
    startDate: "",
    dueDate: "",
  });
  const [createCategoryIds, setCreateCategoryIds] = useState<number[]>([]);
  const [projectCategories, setProjectCategories] = useState<Array<{ id: number; name: string; color: string }>>([]);
  const [screenshots, setScreenshots] = useState<{ url: string; preview: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [refiningField, setRefiningField] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategoryIds, setFilterCategoryIds] = useState<number[]>([]);
  const [filterCategoryMode, setFilterCategoryMode] = useState<"any" | "all">("any");
  const [copiedIssues, setCopiedIssues] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const projectId = resolvedParams.id;

  const fetchProject = useCallback(async (page: number = 1) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      
      // Apply type and priority filters
      if (filterType !== "all") params.set("type", filterType);
      if (filterPriority !== "all") params.set("priority", filterPriority);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterCategoryIds.length > 0) {
        params.set("categoryIds", filterCategoryIds.join(","));
        params.set("categoryMode", filterCategoryMode);
      }

      // Tab filter controls status
      if (issueStatusTab !== "all") {
        params.set("status", issueStatusTab);
      }

      const res = await fetch(`/api/projects/${projectId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setIssues(data.issues || []);
        setIssuesPagination(data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      } else if (res.status === 403 || res.status === 404) {
        router.push("/projects");
      }
    } catch (error) {
      console.error("Failed to fetch project:", error);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filterPriority, filterType, filterCategoryIds, filterCategoryMode, issueStatusTab, projectId, router, token]);



  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(issueSearch);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [issueSearch]);

  useEffect(() => {
    if (token && projectId) {
      setIsLoading(true);
      fetchProject(issuesPaginationState[issueStatusTab]);
    }
  }, [fetchProject, issueStatusTab, issuesPaginationState, projectId, token]);

  const fetchProjectCategories = useCallback(async () => {
    if (!token || !projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjectCategories(data.categories || []);
      }
    } catch {}
  }, [projectId, token]);

  useEffect(() => {
    fetchProjectCategories();
  }, [fetchProjectCategories]);

  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (activeTab === "tasks") params.set("tab", "tasks");
    else if (activeTab === "workspace") params.set("tab", "workspace");
    else if (activeTab === "team") params.set("tab", "team");
    else if (activeTab === "settings") params.set("tab", "settings");
    else params.delete("tab");
    if (issueStatusTab !== "all") params.set("status", issueStatusTab); else params.delete("status");
    const qs = params.toString();
    const next = qs ? `?${qs}` : "";
    const current = searchParams.toString();
    if (qs !== current) {
      router.replace(`/projects/${projectId}${next}`, { scroll: false });
    }
  }, [activeTab, issueStatusTab, projectId, router, searchParams]);

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const handleCreateCategory = async (name: string) => {
    if (!token) return null;
    setIsCreatingCategory(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/categories`, {
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

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setIsCreating(true);

    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...createForm,
          projectId: parseInt(projectId),
          categoryIds: createCategoryIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create issue");
      }

      if (screenshots.length > 0) {
        for (const s of screenshots) {
          await fetch(`/api/issues/${data.issue.id}/attachments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url: s.url }),
          });
        }
      }

      setShowCreateModal(false);
      setCreateForm({ title: "", type: "Bug", description: "", stepsToReproduce: "", expectedResult: "", actualResult: "", priority: "Medium", startDate: "", dueDate: "" });
      setCreateCategoryIds([]);
      setScreenshots([]);
      fetchProject();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create issue");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRefine = async (field: "title" | "description" | "stepsToReproduce" | "expectedResult" | "actualResult") => {
    const content = createForm[field];
    if (!content) return;

    setRefiningField(field);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, field }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreateForm(prev => ({ ...prev, [field]: data.refinedContent }));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to refine content");
      }
    } catch (error) {
      console.error("AI Refine Error:", error);
      alert("Failed to refine content");
    } finally {
      setRefiningField(null);
    }
  };

  const handleSuggest = async (field: "title" | "description" | "stepsToReproduce" | "expectedResult" | "actualResult") => {
    setRefiningField(field);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          field,
          mode: "suggest",
          context: {
            title: createForm.title,
            description: createForm.description,
            stepsToReproduce: createForm.stepsToReproduce,
            expectedResult: createForm.expectedResult,
            actualResult: createForm.actualResult
          }
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreateForm(prev => ({ ...prev, [field]: data.refinedContent }));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to suggest content");
      }
    } catch (error) {
      console.error("AI Suggest Error:", error);
      alert("Failed to suggest content");
    } finally {
      setRefiningField(null);
    }
  };

  const uploadImageFile = async (file: File): Promise<{ url: string; deleteHash?: string } | null> => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) return await res.json();
    } catch (error) {
      console.error("Failed to upload:", error);
    }
    return null;
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setIsUploading(true);
    try {
      const data = await uploadImageFile(file);
      if (data) {
        setScreenshots(prev => [...prev, { url: data.url, preview }]);
      } else {
        URL.revokeObjectURL(preview);
        alert("Failed to upload screenshot. Please try again.");
      }
    } catch (error) {
      console.error("Failed to upload:", error);
      URL.revokeObjectURL(preview);
      alert("Failed to upload screenshot. Please try again.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleScreenshotPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const preview = URL.createObjectURL(file);
        setIsUploading(true);
        try {
          const data = await uploadImageFile(file);
          if (data) {
            setScreenshots(prev => [...prev, { url: data.url, preview }]);
          } else {
            URL.revokeObjectURL(preview);
            alert("Failed to upload screenshot. Please try again.");
          }
        } finally {
          setIsUploading(false);
        }
        return;
      }
    }
  };

  const removeScreenshot = (index: number) => {
    URL.revokeObjectURL(screenshots[index]?.preview);
    setScreenshots(screenshots.filter((_, i) => i !== index));
  };

  const filteredIssues = issues;

  const groupedIssues = Object.values(ISSUE_STATUSES).reduce((acc, status) => {
    acc[status] = filteredIssues.filter((issue) => issue.status === status);
    return acc;
  }, {} as Record<string, Issue[]>);

  const canCreateIssue = user?.role !== "Viewer";

  const handleExportPdf = () => {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    if (filterType !== "all") params.set("type", filterType);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPriority !== "all") params.set("priority", filterPriority);
    if (token) params.set("token", token);
    window.open(`/api/issues/export?${params.toString()}`, "_blank");
  };

  const handleProjectStatusChange = async (issueId: number, newStatus: string) => {
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

  const handleBulkProjectStatusUpdate = async () => {
    if (!bulkProjectStatus || selectedProjectIssueIds.length === 0) return;
    await Promise.all(
      selectedProjectIssueIds.map(id =>
        fetch(`/api/issues/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: bulkProjectStatus }),
        })
      )
    );
    setIssues(prev => prev.map(i => selectedProjectIssueIds.includes(i.id) ? { ...i, status: bulkProjectStatus } : i));
    setSelectedProjectIssueIds([]);
    setBulkProjectStatus("");
  };

  const toggleProjectIssue = (id: number) => {
    setSelectedProjectIssueIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleProjectSelectAll = () => {
    if (selectedProjectIssueIds.length === filteredIssues.length) {
      setSelectedProjectIssueIds([]);
    } else {
      setSelectedProjectIssueIds(filteredIssues.map(i => i.id));
    }
  };

  const [isCopying, setIsCopying] = useState(false);

  const handleCopyAllIssues = async () => {
    if (!project || filteredIssues.length === 0) return;
    setIsCopying(true);
    try {
      // Fetch full details for each issue
      const fullIssues = await Promise.all(
        filteredIssues.map(async (issue) => {
          const res = await fetch(`/api/issues/${issue.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            return data.issue;
          }
          return null;
        })
      );

      const lines: string[] = [];
      lines.push(`Project: ${project.name} (${project.key})`);
      lines.push(`Filter: ${issueStatusTab === "all" ? "All Statuses" : issueStatusTab}`);
      lines.push(`Total: ${issuesPagination.total} issues`);
      lines.push("===================================");
      lines.push("");

      fullIssues.forEach((issue) => {
        if (!issue) return;
        lines.push(`Bug #${issue.id}: ${issue.title}`);
        lines.push(`Type: ${issue.type} | Status: ${issue.status} | Priority: ${issue.priority}`);
        lines.push(`Reporter: ${issue.reporter?.name || "Unknown"} (${issue.reporter?.email || ""})`);
        if (issue.assignees?.length > 0) {
          lines.push(`Assignees: ${issue.assignees.map((a: { user: { name: string } }) => a.user.name).join(", ")}`);
        }
        lines.push(`Created: ${new Date(issue.createdAt).toLocaleString()}`);
        lines.push(`Updated: ${new Date(issue.updatedAt).toLocaleString()}`);
        if (issue.description) {
          lines.push("");
          lines.push(`## Description`);
          lines.push(issue.description);
        }
        if (issue.stepsToReproduce) {
          lines.push("");
          lines.push(`## Steps to Reproduce`);
          lines.push(issue.stepsToReproduce);
        }
        if (issue.expectedResult) {
          lines.push("");
          lines.push(`## Expected Result`);
          lines.push(issue.expectedResult);
        }
        if (issue.actualResult) {
          lines.push("");
          lines.push(`## Actual Result`);
          lines.push(issue.actualResult);
        }
        if (issue.attachments?.length > 0) {
          lines.push("");
          lines.push(`## Attachments`);
          issue.attachments.forEach((att: { url: string }, i: number) => {
            lines.push(`${i + 1}. ${att.url}`);
          });
        }
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

  const handleIssuePageChange = (newPage: number) => {
    setIssuesPaginationState(prev => ({ ...prev, [issueStatusTab]: newPage }));
  };











  if (isLoading) {
    return <PageLoader />;
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-bg border-b border-border">
        <div className="px-3 md:px-8 py-3 md:py-4">
          <div className="flex flex-col gap-3 md:gap-0 md:flex-row md:items-center md:justify-between md:max-w-[1400px] md:mx-auto">
            <div className="flex items-center justify-between md:justify-start md:flex-1">
              <div className="flex items-center gap-2">
                <Link href={searchParams.get("wsmod") ? `/projects/${projectId}?tab=workspace` : "/projects"} className="flex items-center gap-1 p-1.5 md:p-2 rounded-lg hover:bg-bg-hover transition-colors text-fg-muted">
                  <ChevronLeft className="w-4 h-4 md:w-5 h-5" />
                </Link>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="text-lg md:text-2xl font-medium truncate max-w-[120px] md:max-w-none text-fg">
                    {project.name}
                  </span>
                  <span className="text-xs md:text-sm px-1.5 md:px-2 py-0.5 rounded-full bg-bg-subtle text-fg-muted">
                    {project.key}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="flex items-center gap-1.5 md:gap-2 flex-1 md:flex-none">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={issueSearch}
                    onChange={(e) => setIssueSearch(e.target.value)}
                    className="w-full min-w-[120px] md:w-64 px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg border border-transparent bg-bg-subtle transition-all focus:outline-none focus:border-accent text-fg placeholder:text-fg-placeholder"
                  />
                </div>
                <button
                  onClick={async () => {
                    setIsRefreshing(true);
                    setIssueSearch("");
                    if (activeTab === "issues") {
                      await fetchProject(1);
                    }
                    setIsRefreshing(false);
                  }}
                  className="p-1.5 md:p-2 rounded-lg transition-all hover:bg-bg-hover disabled:opacity-50 text-fg-muted"
                  disabled={isRefreshing}
                  title="Refresh"
                >
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                </button>
              </div>

              {activeTab === "issues" && canCreateIssue && (
                <FabButton
                  icon={Plus}
                  label="New Issue"
                  labelMobile="New"
                  onClick={() => setShowCreateModal(true)}
                  isLoading={isCreating}
                />
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-3 md:px-8 mb-4 md:mb-6">
          <div className="flex items-center gap-2 md:gap-1 max-w-[1400px] mx-auto">
            <div className="flex-1 overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 md:flex-none">
              <div className="flex p-1 rounded-xl bg-bg-hover w-fit min-w-max">
                {(["issues", "tasks", "workspace", "team", "settings"] as const).map((tab) => {
                  const labels: Record<string, string> = { issues: "Issues", tasks: "Tasks", workspace: "Workspace", team: "Team Progress", settings: "Settings" };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex-1 md:flex-none px-4 md:px-5 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer",
                        activeTab === tab
                          ? "bg-surface text-fg shadow-sm"
                          : "text-fg-muted hover:text-fg hover:bg-bg-hover"
                      )}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
            </div>
            <span className="ml-auto text-sm whitespace-nowrap text-fg-subtle">
              {activeTab === "issues" && `${issuesPagination.total} ${issuesPagination.total === 1 ? "issue" : "issues"}`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-3 md:p-8 max-w-[1400px] mx-auto">
        {activeTab === "issues" && (
          <>
            {/* Status Tabs */}
            <div className="overflow-x-auto pb-2 mb-4 md:mb-6 -mx-3 px-3 md:px-0">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-hover w-fit min-w-max">
                {[
                  { key: "all", label: "All" },
                  { key: "Open", label: "Open" },
                  { key: "In Progress", label: "In Progress" },
                  { key: "In Review", label: "In Review" },
                  { key: "Closed", label: "Closed" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setIssueStatusTab(tab.key)}
                    className={cn(
                      "px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer",
                      issueStatusTab === tab.key
                        ? "bg-surface text-fg shadow-sm"
                        : "text-fg-muted hover:text-fg"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Today's activity banner */}
            {(() => {
              if (!project?.todayActivity) return null;
              const { created, updated, actors } = project.todayActivity;
              if (created === 0 && updated === 0) {
                return (
                  <div className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm bg-warning-bg border border-warning/30">
                    <span className="font-semibold text-warning">No activity today</span>
                    <span className="text-warning/80">· Nothing was updated or created across the project today</span>
                  </div>
                );
              }
              return (
                <div className="mb-4 px-4 py-2.5 rounded-xl flex flex-wrap items-center gap-x-4 gap-y-1 text-sm bg-success-bg border border-success/30">
                  <span className="font-semibold text-success">Today</span>
                  <span className="text-success">{created} created</span>
                  <span className="text-success">{updated} updated</span>
                  {actors.length > 0 && (
                    <span className="text-success">{actors.slice(0, 4).join(", ")}{actors.length > 4 ? ` +${actors.length - 4}` : ""}</span>
                  )}
                </div>
              );
            })()}

            <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-fg-muted">
              We shifted bug and feature tracking to the new Workspace Bugs and Features pages. Please create new bugs and feature requests there from the Workspace tab.
            </div>

            {/* Filters & View Toggle - Stack on mobile */}
            <div className="mb-4 flex flex-col gap-3 md:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Select
                options={[
                  { value: "all", label: "All Types" },
                  ...Object.values(ISSUE_TYPES).map((t) => ({ value: t, label: t })),
                ]}
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setIssuesPaginationState(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 1]))); }}
                wrapperClassName="w-full sm:w-36"
              />
              <Select
                options={[
                  { value: "all", label: "All Priorities" },
                  ...Object.values(ISSUE_PRIORITIES).map((p) => ({ value: p, label: p })),
                ]}
                value={filterPriority}
                onChange={(e) => { setFilterPriority(e.target.value); setIssuesPaginationState(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 1]))); }}
                wrapperClassName="w-full sm:w-40"
              />

              {projectCategories.length > 0 && (
                <div className="flex w-full min-w-0 items-center gap-2 sm:min-w-[260px] sm:flex-1">
                  <div className="flex-1">
                    <MultiSelectChips
                      options={projectCategories.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
                      value={filterCategoryIds}
                      onChange={(ids) => { setFilterCategoryIds(ids); setIssuesPaginationState(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 1]))); }}
                      placeholder="Filter by categories"
                      searchable
                      onCreateOption={async (name) => {
                        const id = await handleCreateCategory(name);
                        if (id) {
                          setFilterCategoryIds([...filterCategoryIds, id]);
                          setIssuesPaginationState(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 1])));
                        }
                      }}
                      isCreating={isCreatingCategory}
                    />
                  </div>
                  {filterCategoryIds.length > 1 && (
                    <div className="flex p-0.5 rounded-md text-xs bg-bg-hover border border-border">
                      <button
                        type="button"
                        onClick={() => setFilterCategoryMode("any")}
                        className={cn("px-2 py-1 rounded font-medium cursor-pointer", filterCategoryMode === "any" ? "bg-surface text-fg shadow-sm" : "text-fg-muted")}
                        title="Match ANY (OR)"
                      >ANY</button>
                      <button
                        type="button"
                        onClick={() => setFilterCategoryMode("all")}
                        className={cn("px-2 py-1 rounded font-medium cursor-pointer", filterCategoryMode === "all" ? "bg-surface text-fg shadow-sm" : "text-fg-muted")}
                        title="Match ALL (AND)"
                      >ALL</button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                <div className="flex p-1 rounded-xl bg-bg-hover">
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn("p-2 rounded-lg transition-all cursor-pointer", viewMode === "list" ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("board")}
                    className={cn("p-2 rounded-lg transition-all cursor-pointer", viewMode === "board" ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
                    title="Board view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleCopyAllIssues}
                  className="flex items-center gap-2"
                  disabled={filteredIssues.length === 0 || isCopying}
                >
                  {copiedIssues ? <Check className="w-4 h-4 text-success" /> : <Clipboard className="w-4 h-4" />}
                  <span>{isCopying ? "Copying..." : copiedIssues ? "Copied!" : "Copy"}</span>
                </Button>
                <Button variant="secondary" onClick={handleExportPdf} className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </Button>
              </div>
            </div>

            {/* Bulk status update bar */}
            {selectedProjectIssueIds.length > 0 && (
              <div className="mb-4 flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent-subtle p-3 sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-fg">{selectedProjectIssueIds.length} selected</span>
                <Select
                  options={[
                    { value: "", label: "Change status to..." },
                    ...Object.values(ISSUE_STATUSES).map(s => ({ value: s, label: s })),
                  ]}
                  value={bulkProjectStatus}
                  onChange={(e) => setBulkProjectStatus(e.target.value)}
                  wrapperClassName="w-full sm:w-44"
                />
                <Button variant="primary" onClick={handleBulkProjectStatusUpdate} disabled={!bulkProjectStatus} className="text-sm">
                  Update
                </Button>
                <button onClick={() => setSelectedProjectIssueIds([])} className="ml-auto text-sm text-fg-muted hover:text-fg cursor-pointer">
                  Clear
                </button>
              </div>
            )}

            {viewMode === "list" && (
              <div className="rounded-2xl border border-border overflow-hidden bg-surface shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="bg-bg-subtle">
                        <th className="text-left px-5 py-4 w-10">
                          <Checkbox
                            checked={filteredIssues.length > 0 && selectedProjectIssueIds.length === filteredIssues.length}
                            onCheckedChange={toggleProjectSelectAll}
                            aria-label="Select all issues"
                          />
                        </th>
                        {["ID", "Title", "Type", "Status", "Priority", "Assignees", "Created", "Updated", ""].map((h) => (
                          <th key={h} className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide text-fg-muted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="text-center py-16 text-fg-placeholder">
                            No issues found — create your first issue to get started
                          </td>
                        </tr>
                      ) : (
                        filteredIssues.map((issue) => (
                          <tr key={issue.id} className="border-b border-border-subtle transition-colors hover:bg-bg-subtle">
                            <td className="px-5 py-4">
                              <Checkbox
                                checked={selectedProjectIssueIds.includes(issue.id)}
                                onCheckedChange={() => toggleProjectIssue(issue.id)}
                                aria-label={`Select issue ${issue.id}`}
                              />
                            </td>
                            <td className="px-5 py-4 text-sm font-mono text-fg-placeholder">
                              #{issue.id}
                            </td>
                            <td className="px-5 py-4 text-sm font-medium text-fg">
                              <div className="flex flex-col gap-1">
                                <span>{issue.title}</span>
                                {issue.categories && issue.categories.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {issue.categories.map(({ category }) => (
                                      <span
                                        key={category.id}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{ backgroundColor: category.color, color: contrastingText(category.color) }}
                                      >
                                        {category.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <TypeBadge type={issue.type} />
                            </td>
                            <td className="px-5 py-4">
                              <StatusBadge status={issue.status} />
                            </td>
                            <td className="px-5 py-4">
                              <select
                                value={issue.status}
                                onChange={(e) => handleProjectStatusChange(issue.id, e.target.value)}
                                className="text-sm px-3 py-2 rounded-lg border border-border cursor-pointer bg-surface text-fg"
                              >
                                {Object.values(ISSUE_STATUSES).map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <PriorityDot priority={issue.priority} />
                                <span className="text-sm text-fg-muted">{issue.priority}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {issue.assignees.length > 0 ? (
                                <AvatarGroup names={issue.assignees.map((a) => a.user.name)} />
                              ) : (
                                <span className="text-sm text-fg-placeholder">Unassigned</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {(() => {
                                const c = formatActivity(issue.createdAt);
                                if (!c) return <span className="text-xs text-fg-placeholder">—</span>;
                                return (
                                  <div className="flex flex-col" title={issue.createdAt ? new Date(issue.createdAt).toLocaleString() : ""}>
                                    <span className={cn("text-xs font-medium", c.isToday ? "text-success" : "text-fg-muted")}>{c.label}</span>
                                    {c.isToday && <span className="text-[10px] font-semibold text-success">TODAY</span>}
                                    {issue.reporter && <span className="text-[10px] text-fg-placeholder">by {issue.reporter.name.split(" ")[0]}</span>}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-5 py-4">
                              {(() => {
                                const u = formatActivity(issue.updatedAt);
                                if (!u) return <span className="text-xs text-fg-placeholder">—</span>;
                                return (
                                  <div className="flex flex-col" title={new Date(issue.updatedAt).toLocaleString()}>
                                    <span className={cn("text-xs font-medium", u.isToday ? "text-success" : "text-fg-muted")}>{u.label}</span>
                                    {u.isToday && <span className="text-[10px] font-semibold text-success">TODAY</span>}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-5 py-4">
                              <button
                                onClick={() => {
                                  try { sessionStorage.setItem(`project-return:${projectId}`, window.location.pathname + window.location.search); } catch {}
                                  router.push(`/issues/${issue.id}`);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-accent-subtle text-accent hover:bg-accent hover:text-accent-fg transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Board View */}
            {viewMode === "board" && (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {Object.entries(groupedIssues).map(([status, statusIssues]) => (
                    <div
                      key={status}
                      className="flex-shrink-0 w-80 rounded-2xl p-4 bg-bg-subtle"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-sm text-fg">
                          {status}
                        </h3>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full shadow-sm bg-surface text-fg-muted">
                          {statusIssues.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {statusIssues.map((issue) => (
                          <Link
                            key={issue.id}
                            href={`/issues/${issue.id}`}
                            onClick={() => { try { sessionStorage.setItem(`project-return:${projectId}`, window.location.pathname + window.location.search); } catch {} }}
                            className="block rounded-xl p-4 bg-surface border border-border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-xs font-mono text-fg-placeholder">
                                #{issue.id}
                              </span>
                              <TypeBadge type={issue.type} />
                            </div>
                            <h4 className="text-sm font-medium mb-3 line-clamp-2 text-fg">
                              {issue.title}
                            </h4>
                            <div className="flex items-center justify-between">
                              <PriorityDot priority={issue.priority} />
                              {issue.assignees.length > 0 && (
                                <AvatarGroup names={issue.assignees.map((a) => a.user.name)} max={2} />
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagination */}
            {issuesPagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4 px-1">
                <span className="text-[13px] text-fg-muted">
                  Showing {((issuesPaginationState[issueStatusTab] - 1) * issuesPagination.limit) + 1} to {Math.min(issuesPaginationState[issueStatusTab] * issuesPagination.limit, issuesPagination.total)} of {issuesPagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleIssuePageChange(issuesPaginationState[issueStatusTab] - 1)}
                    disabled={issuesPaginationState[issueStatusTab] === 1}
                    className="p-2 rounded-lg border border-border hover:bg-surface hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[13px] tabular-nums text-fg-muted">
                    Page {issuesPaginationState[issueStatusTab]} of {issuesPagination.totalPages}
                  </span>
                  <button
                    onClick={() => handleIssuePageChange(issuesPaginationState[issueStatusTab] + 1)}
                    disabled={issuesPaginationState[issueStatusTab] >= issuesPagination.totalPages}
                    className="p-2 rounded-lg border border-border hover:bg-surface hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "tasks" && <ListsWorkspace projectId={projectId} />}

        {activeTab === "workspace" && <ProjectWorkspacePanel projectId={Number(projectId)} />}

        {activeTab === "team" && <TeamProgress projectId={projectId} />}

        {activeTab === "settings" && (
          <CategoriesManager
            projectId={parseInt(projectId)}
            canEdit={user?.role === "Admin" || user?.role === "QA"}
          />
        )}
      </div>

      {/* Create Issue Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); screenshots.forEach(s => URL.revokeObjectURL(s.preview)); setScreenshots([]); }}
        title="Create New Issue"
      >
        <form onSubmit={handleCreateIssue} className="space-y-4">
          {createError && (
            <div className="p-3 text-sm rounded-md border border-danger/30 bg-danger/10 text-danger">
              {createError}
            </div>
          )}

          <div>
            <Input
              id="title"
              label="Title"
              placeholder="Issue title"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              required
              rightSlot={
                <button
                  type="button"
                  onClick={() => createForm.title ? handleRefine("title") : handleSuggest("title")}
                  disabled={refiningField === "title"}
                  className="p-1.5 hover:opacity-80 disabled:opacity-50 cursor-pointer transition-opacity"
                  title={createForm.title ? "AI Refine" : "AI Suggest"}
                >
                  <Sparkles className={cn("w-4 h-4 text-accent", refiningField === "title" && "animate-pulse")} />
                </button>
              }
            />
          </div>

          <div className="flex gap-4">
            <Select
              id="type"
              label="Type"
              options={Object.values(ISSUE_TYPES).map((t) => ({ value: t, label: t }))}
              value={createForm.type}
              onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
              fullWidth={false}
              wrapperClassName="flex-1 min-w-0 w-full"
            />
            <Select
              id="priority"
              label="Priority"
              options={Object.values(ISSUE_PRIORITIES).map((p) => ({ value: p, label: p }))}
              value={createForm.priority}
              onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
              fullWidth={false}
              wrapperClassName="flex-1 min-w-0 w-full"
            />
          </div>

          <MultiSelectChips
            label="Categories"
            options={projectCategories.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
            value={createCategoryIds}
            onChange={setCreateCategoryIds}
            placeholder="Search or add category..."
            onCreateOption={async (name) => {
              const id = await handleCreateCategory(name);
              if (id) {
                setCreateCategoryIds([...createCategoryIds, id]);
              }
            }}
            isCreating={isCreatingCategory}
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-fg">
                Description
              </label>
              <button
                type="button"
                onClick={() => createForm.description ? handleRefine("description") : handleSuggest("description")}
                disabled={refiningField === "description"}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all disabled:opacity-50 text-accent hover:bg-accent-subtle"
                title={createForm.description ? "AI Refine" : "AI Suggest"}
              >
                <Sparkles className={`w-3 h-3 ${refiningField === "description" ? "animate-pulse" : ""}`} />
                {refiningField === "description" ? (createForm.description ? "Refining..." : "Suggesting...") : (createForm.description ? "AI Refine" : "AI Suggest")}
              </button>
            </div>
            <MarkdownEditor
              value={createForm.description}
              onChange={(v) => setCreateForm({ ...createForm, description: v })}
              placeholder="Describe the issue..."
              minRows={4}
            />
          </div>

          {createForm.type === "Bug" && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-fg">
                Steps to Reproduce
              </label>
              <button
                type="button"
                onClick={() => createForm.stepsToReproduce ? handleRefine("stepsToReproduce") : handleSuggest("stepsToReproduce")}
                disabled={refiningField === "stepsToReproduce"}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all disabled:opacity-50 text-accent hover:bg-accent-subtle"
                title={createForm.stepsToReproduce ? "AI Refine" : "AI Suggest"}
              >
                    <Sparkles className={`w-3 h-3 ${refiningField === "stepsToReproduce" ? "animate-pulse" : ""}`} />
                    {refiningField === "stepsToReproduce" ? (createForm.stepsToReproduce ? "Refining..." : "Suggesting...") : (createForm.stepsToReproduce ? "AI Refine" : "AI Suggest")}
                  </button>
                </div>
                <MarkdownEditor
                  value={createForm.stepsToReproduce}
                  onChange={(v) => setCreateForm({ ...createForm, stepsToReproduce: v })}
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                  minRows={4}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-fg">
                Expected Result
              </label>
              <button
                type="button"
                onClick={() => createForm.expectedResult ? handleRefine("expectedResult") : handleSuggest("expectedResult")}
                disabled={refiningField === "expectedResult"}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all disabled:opacity-50 text-accent hover:bg-accent-subtle"
                title={createForm.expectedResult ? "AI Refine" : "AI Suggest"}
              >
                    <Sparkles className={`w-3 h-3 ${refiningField === "expectedResult" ? "animate-pulse" : ""}`} />
                    {refiningField === "expectedResult" ? (createForm.expectedResult ? "Refining..." : "Suggesting...") : (createForm.expectedResult ? "AI Refine" : "AI Suggest")}
                  </button>
                </div>
                <MarkdownEditor
                  value={createForm.expectedResult}
                  onChange={(v) => setCreateForm({ ...createForm, expectedResult: v })}
                  placeholder="What should happen..."
                  minRows={2}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-fg">
                Actual Result
              </label>
              <button
                type="button"
                onClick={() => createForm.actualResult ? handleRefine("actualResult") : handleSuggest("actualResult")}
                disabled={refiningField === "actualResult"}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all disabled:opacity-50 text-accent hover:bg-accent-subtle"
                title={createForm.actualResult ? "AI Refine" : "AI Suggest"}
              >
                    <Sparkles className={`w-3 h-3 ${refiningField === "actualResult" ? "animate-pulse" : ""}`} />
                    {refiningField === "actualResult" ? (createForm.actualResult ? "Refining..." : "Suggesting...") : (createForm.actualResult ? "AI Refine" : "AI Suggest")}
                  </button>
                </div>
                <MarkdownEditor
                  value={createForm.actualResult}
                  onChange={(v) => setCreateForm({ ...createForm, actualResult: v })}
                  placeholder="What actually happens..."
                  minRows={2}
                />
              </div>
            </>
          )}

          <div className="flex gap-4">
            <div className="flex-1 min-w-0 w-full">
              <label className="block text-sm font-medium mb-1.5 text-fg">
                Start Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none"
                value={createForm.startDate}
                onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
              />
            </div>
            <div className="flex-1 min-w-0 w-full">
              <label className="block text-sm font-medium mb-1.5 text-fg">
                Due Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none"
                value={createForm.dueDate}
                onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div onPaste={handleScreenshotPaste}>
            <label className="block text-sm font-medium mb-1.5 text-fg">
              Screenshots
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {screenshots.map((s, index) => (
                <div key={index} className="relative w-16 h-16 rounded overflow-hidden border border-border group cursor-pointer hover:border-accent transition-all">
                  <img
                    src={s.preview}
                    alt={`screenshot-${index}`}
                    className="w-full h-full object-cover"
                    onClick={() => setPreviewImage(s.preview)}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeScreenshot(index); }}
                    className="absolute top-0 right-0 p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-border rounded-md cursor-pointer text-fg-muted hover:border-accent hover:text-accent transition-all">
              {isUploading ? (
                "Uploading..."
              ) : (
                <>
                  <Image className="w-4 h-4" />
                  Add screenshot
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleScreenshotUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
            <p className="text-[10px] mt-1 text-center text-fg-placeholder">or paste with Ctrl+V</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Issue"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Screenshot Preview Overlay */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center cursor-pointer bg-black/90"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full text-white bg-white/20 hover:opacity-80 transition-opacity"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>)}



    </div>
  )
}
