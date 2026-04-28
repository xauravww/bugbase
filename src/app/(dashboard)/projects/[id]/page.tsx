"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, List, LayoutGrid, ChevronLeft, ChevronRight, Image, X, Download, Flag, Sparkles, Wand2, Clipboard, Check, ExternalLink, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Modal, Input, Select, PageLoader, StatusBadge, TypeBadge, PriorityDot, AvatarGroup, FabButton } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_TYPES } from "@/constants";
import { MilestoneList, CreateMilestoneModal, MilestoneDetailModal, MilestonePagination } from "@/components/milestones";
import type { MilestoneWithDetails, Pagination } from "@/types/milestone";

interface Issue {
  id: number;
  title: string;
  type: string;
  status: string;
  priority: string;
  reporterId: number;
  updatedAt: string;
  assignees: Array<{ user: { id: number; name: string } }>;
}

interface Project {
  id: number;
  name: string;
  key: string;
  description: string | null;
  members: Array<{ user: { id: number; name: string; email: string }; role: string }>;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { token, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [milestones, setMilestones] = useState<MilestoneWithDetails[]>([]);
  const [milestonesPagination, setMilestonesPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
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
  const [activeTab, setActiveTab] = useState<"issues" | "milestones">("issues");
  const [issueStatusTab, setIssueStatusTab] = useState<string>("all");
  const [issuesPaginationState, setIssuesPaginationState] = useState<Record<string, number>>({ all: 1, Open: 1, "In Progress": 1, "In Review": 1, Closed: 1 });
  const [selectedProjectIssueIds, setSelectedProjectIssueIds] = useState<number[]>([]);
  const [bulkProjectStatus, setBulkProjectStatus] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateMilestoneModal, setShowCreateMilestoneModal] = useState(false);
  const [showMilestoneDetailModal, setShowMilestoneDetailModal] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneWithDetails | null>(null);
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
  const [screenshots, setScreenshots] = useState<{ url: string; preview: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
  const [isUpdatingMilestone, setIsUpdatingMilestone] = useState(false);
  const [isAddingMilestoneNote, setIsAddingMilestoneNote] = useState(false);
  const [refiningField, setRefiningField] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [copiedIssues, setCopiedIssues] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const projectId = resolvedParams.id;

  const fetchProject = async (page: number = 1) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      
      // Apply type and priority filters
      if (filterType !== "all") params.set("type", filterType);
      if (filterPriority !== "all") params.set("priority", filterPriority);
      if (debouncedSearch) params.set("search", debouncedSearch);

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
  };

  const fetchMilestones = async (page: number = 1) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");

      const res = await fetch(`/api/projects/${projectId}/milestones?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMilestones(data.milestones || []);
        setMilestonesPagination(data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      }
    } catch (error) {
      console.error("Failed to fetch milestones:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
      if (activeTab === "issues") {
        fetchProject(issuesPaginationState[issueStatusTab]);
      } else {
        fetchMilestones(milestonesPagination.page);
      }
    }
  }, [token, projectId, activeTab, issueStatusTab, issuesPaginationState, filterType, filterPriority, debouncedSearch]);

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

  const handleCreateMilestone = async (data: { title: string; description?: string; checklistItems: string[] }) => {
    setIsCreatingMilestone(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setShowCreateMilestoneModal(false);
        fetchMilestones(); // Refresh the milestones list
      } else {
        const errorData = await res.json();
        setCreateError(errorData.error || "Failed to create milestone");
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create milestone");
    } finally {
      setIsCreatingMilestone(false);
    }
  };

  const handleUpdateMilestone = async (data: { title: string; description?: string; status: string; checklistItems?: Array<{ id?: number; content: string }> }) => {
    if (!selectedMilestone) return;

    // Optimistically update the UI
    const updatedMilestone = {
      ...selectedMilestone,
      ...data,
      updatedAt: new Date()
    };

    setSelectedMilestone(updatedMilestone as MilestoneWithDetails);
    setIsUpdatingMilestone(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${selectedMilestone.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setShowMilestoneDetailModal(false);
        fetchMilestones(); // Refresh the milestones list
      } else {
        const errorData = await res.json();
        setCreateError(errorData.error || "Failed to update milestone");
        // Revert on error
        setSelectedMilestone(selectedMilestone);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to update milestone");
      // Revert on error
      setSelectedMilestone(selectedMilestone);
    } finally {
      setIsUpdatingMilestone(false);
    }
  };

  const handleToggleChecklistItem = async (itemId: number, completed: boolean, notes: string) => {
    if (!selectedMilestone || !user) return;

    // Optimistically update the UI
    const updatedMilestone = {
      ...selectedMilestone,
      checklistItems: selectedMilestone.checklistItems.map(item =>
        item.id === itemId
          ? {
            ...item,
            completion: completed
              ? {
                id: Date.now(), // temporary ID
                checklistItemId: itemId,
                userId: user.id,
                notes: notes || null,
                completedAt: new Date(),
                user: {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  createdAt: user.createdAt
                }
              }
              : null
          }
          : item
      ),
      completedCount: completed
        ? selectedMilestone.completedCount + 1
        : selectedMilestone.completedCount - 1
    };

    setSelectedMilestone(updatedMilestone as MilestoneWithDetails);

    try {
      if (completed) {
        // Mark as complete
        const res = await fetch(`/api/projects/${projectId}/milestones/${selectedMilestone.id}/checklist/${itemId}/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notes }),
        });

        if (res.ok) {
          fetchMilestones(); // Refresh the milestones list
        } else {
          // Revert on error
          setSelectedMilestone(selectedMilestone);
        }
      } else {
        // Mark as incomplete
        const res = await fetch(`/api/projects/${projectId}/milestones/${selectedMilestone.id}/checklist/${itemId}/complete`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          fetchMilestones(); // Refresh the milestones list
        } else {
          // Revert on error
          setSelectedMilestone(selectedMilestone);
        }
      }
    } catch (err) {
      console.error("Failed to toggle checklist item:", err);
      // Revert on error
      setSelectedMilestone(selectedMilestone);
    }
  };

  const handleMilestonePageChange = (newPage: number) => {
    fetchMilestones(newPage);
    setMilestonesPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleIssuePageChange = (newPage: number) => {
    setIssuesPaginationState(prev => ({ ...prev, [issueStatusTab]: newPage }));
  };

  const handleAddMilestoneNote = async (content: string) => {
    if (!selectedMilestone || !user) return;

    // Optimistically update the UI
    const newNote = {
      id: Date.now(), // temporary ID
      milestoneId: selectedMilestone.id,
      userId: user.id,
      content,
      createdAt: new Date(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    };

    const updatedMilestone = {
      ...selectedMilestone,
      notes: [...selectedMilestone.notes, newNote]
    };

    setSelectedMilestone(updatedMilestone as MilestoneWithDetails);
    setIsAddingMilestoneNote(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${selectedMilestone.id}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        fetchMilestones(); // Refresh the milestones list
      } else {
        const errorData = await res.json();
        setCreateError(errorData.error || "Failed to add note");
        // Revert on error
        setSelectedMilestone(selectedMilestone);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to add note");
      // Revert on error
      setSelectedMilestone(selectedMilestone);
    } finally {
      setIsAddingMilestoneNote(false);
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: "#ffffff" }}>
      {/* Hero Header - Miro style */}
      <div className="sticky top-0 z-40" style={{ background: "#ffffff", borderBottom: "1px solid #e9eaef" }}>
        <div className="px-3 md:px-8 py-3 md:py-4">
          {/* Mobile: Stack vertically */}
          <div className="flex flex-col gap-3 md:gap-0 md:flex-row md:items-center md:justify-between md:max-w-[1400px] md:mx-auto">
            {/* Breadcrumb - Stack on mobile */}
            <div className="flex items-center justify-between md:justify-start md:flex-1">
              <div className="flex items-center gap-2">
                <Link href="/projects" className="flex items-center gap-1 p-1.5 md:p-2 rounded-lg hover:bg-gray-50 transition-colors" style={{ color: "#555a6a" }}>
                  <ChevronLeft className="w-4 h-4 md:w-5 h-5" />
                </Link>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="text-lg md:text-2xl font-medium truncate max-w-[120px] md:max-w-none" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                    {project.name}
                  </span>
                  <span className="text-xs md:text-sm px-1.5 md:px-2 py-0.5 rounded-full" style={{ background: "#f7f6f3", color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
                    {project.key}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Header Actions - Wrap on mobile */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {/* Search with Refresh */}
              <div className="flex items-center gap-1.5 md:gap-2 flex-1 md:flex-none">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={issueSearch}
                    onChange={(e) => setIssueSearch(e.target.value)}
                    className="w-full min-w-[120px] md:w-64 px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg border transition-all focus:outline-none focus:border-[#5b76fe]"
                    style={{ background: "#f7f6f3", borderColor: "transparent", fontFamily: "DM Sans, sans-serif" }}
                  />
                </div>
                <button
                  onClick={async () => {
                    setIsRefreshing(true);
                    setIssueSearch("");
                    await fetchProject(1);
                    if (activeTab === "milestones") {
                      await fetchMilestones(1);
                    }
                    setIsRefreshing(false);
                  }}
                  className="p-1.5 md:p-2 rounded-lg transition-all hover:bg-gray-100 disabled:opacity-50"
                  style={{ color: "#555a6a" }}
                  disabled={isRefreshing}
                  title="Refresh"
                >
                  <RefreshCw 
                    className="w-4 h-4" 
                    style={{ 
                      animation: isRefreshing ? "spin 1s linear infinite" : "none"
                    }} 
                  />
                </button>
              </div>
              
              {/* Create Button - Using FabButton for consistency */}
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
        
        {/* Tab Navigation - Unified segment control */}
        <div className="px-3 md:px-8">
          <div className="flex items-center gap-2 md:gap-1 max-w-[1400px] mx-auto">
            <div className="flex p-1 rounded-xl flex-1 md:flex-none" style={{ background: "#f7f6f3" }}>
              <button
                onClick={() => setActiveTab("issues")}
                className="flex-1 md:flex-none px-4 md:px-5 py-2.5 text-sm font-medium rounded-lg transition-all"
                style={{ 
                  background: activeTab === "issues" ? "#ffffff" : "transparent", 
                  color: activeTab === "issues" ? "#1c1c1e" : "#555a6a",
                  fontFamily: "DM Sans, sans-serif",
                  boxShadow: activeTab === "issues" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "issues") {
                    e.currentTarget.style.background = "#e9e9e9";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "issues") {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <span className="md:hidden">Issues</span>
                <span className="hidden md:inline">Issues</span>
              </button>
              <button
                onClick={() => setActiveTab("milestones")}
                className="flex-1 md:flex-none px-4 md:px-5 py-2.5 text-sm font-medium rounded-lg transition-all"
                style={{ 
                  background: activeTab === "milestones" ? "#ffffff" : "transparent", 
                  color: activeTab === "milestones" ? "#1c1c1e" : "#555a6a",
                  fontFamily: "DM Sans, sans-serif",
                  boxShadow: activeTab === "milestones" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "milestones") {
                    e.currentTarget.style.background = "#e9e9e9";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "milestones") {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <span className="md:hidden">Milestones</span>
                <span className="hidden md:inline">Milestones</span>
              </button>
            </div>
            
            {/* Issue count badge */}
            {activeTab === "issues" && (
              <span className="ml-auto text-sm whitespace-nowrap" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>
                {issuesPagination.total} {issuesPagination.total === 1 ? "issue" : "issues"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-3 md:p-8 max-w-[1400px] mx-auto">
        {activeTab === "issues" && (
          <>
            {/* Status Tabs - Horizontal scroll on mobile */}
            <div className="overflow-x-auto pb-2 mb-4 md:mb-6 -mx-3 px-3 md:px-0">
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "#f7f6f3", width: "fit-content", minWidth: "max-content" }}>
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
                    className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all whitespace-nowrap"
                    style={{
                      background: issueStatusTab === tab.key ? "#ffffff" : "transparent",
                      color: issueStatusTab === tab.key ? "#1c1c1e" : "#555a6a",
                      fontFamily: "DM Sans, sans-serif",
                      boxShadow: issueStatusTab === tab.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
                    }}
                    onMouseEnter={(e) => {
                      if (issueStatusTab !== tab.key) {
                        e.currentTarget.style.background = "#e9e9e9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (issueStatusTab !== tab.key) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters & View Toggle - Stack on mobile */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 md:mb-6">
              <Select
                options={[
                  { value: "all", label: "All Types" },
                  ...Object.values(ISSUE_TYPES).map((t) => ({ value: t, label: t })),
                ]}
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setIssuesPaginationState(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 1]))); }}
                className="w-36"
              />
              <Select
                options={[
                  { value: "all", label: "All Priorities" },
                  ...Object.values(ISSUE_PRIORITIES).map((p) => ({ value: p, label: p })),
                ]}
                value={filterPriority}
                onChange={(e) => { setFilterPriority(e.target.value); setIssuesPaginationState(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 1]))); }}
                className="w-40"
              />
              
              <div className="flex items-center gap-2 ml-auto">
                {/* View Toggle */}
                <div className="flex p-1 rounded-xl" style={{ background: "#f7f6f3" }}>
                  <button
                    onClick={() => setViewMode("list")}
                    className="p-2 rounded-lg transition-all"
                    style={{ 
                      background: viewMode === "list" ? "#ffffff" : "transparent", 
                      boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      fontFamily: "DM Sans, sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      if (viewMode !== "list") {
                        e.currentTarget.style.background = "#e9e9e9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (viewMode !== "list") {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                    title="List view"
                  >
                    <List className="w-4 h-4" style={{ color: viewMode === "list" ? "#1c1c1e" : "#555a6a" }} />
                  </button>
                  <button
                    onClick={() => setViewMode("board")}
                    className="p-2 rounded-lg transition-all"
                    style={{ 
                      background: viewMode === "board" ? "#ffffff" : "transparent", 
                      boxShadow: viewMode === "board" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      fontFamily: "DM Sans, sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      if (viewMode !== "board") {
                        e.currentTarget.style.background = "#e9e9e9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (viewMode !== "board") {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                    title="Board view"
                  >
                    <LayoutGrid className="w-4 h-4" style={{ color: viewMode === "board" ? "#1c1c1e" : "#555a6a" }} />
                  </button>
                </div>
                
                <Button
                  variant="secondary"
                  onClick={handleCopyAllIssues}
                  className="flex items-center gap-2"
                  style={{ 
                    border: "1px solid #e9eaef", 
                    borderRadius: "8px",
                    fontFamily: "DM Sans, sans-serif",
                    padding: "8px 12px"
                  }}
                  disabled={filteredIssues.length === 0 || isCopying}
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
              </div>
            </div>

            {/* Bulk status update bar */}
            {selectedProjectIssueIds.length > 0 && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: "#c3faf5", border: "1px solid #5b76fe" }}>
                <span className="text-sm font-medium" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>{selectedProjectIssueIds.length} selected</span>
                <Select
                  options={[
                    { value: "", label: "Change status to..." },
                    ...Object.values(ISSUE_STATUSES).map(s => ({ value: s, label: s })),
                  ]}
                  value={bulkProjectStatus}
                  onChange={(e) => setBulkProjectStatus(e.target.value)}
                  className="w-44"
                />
                <Button variant="primary" onClick={handleBulkProjectStatusUpdate} disabled={!bulkProjectStatus} className="text-sm" style={{ background: "#5b76fe", borderRadius: "8px" }}>
                  Update
                </Button>
                <button onClick={() => setSelectedProjectIssueIds([])} className="text-sm ml-auto hover:opacity-80" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
                  Clear
                </button>
              </div>
            )}

            {/* List View */}
            {viewMode === "list" && (
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#e9eaef", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th className="text-left px-5 py-4 w-10">
                          <input 
                            type="checkbox" 
                            checked={filteredIssues.length > 0 && selectedProjectIssueIds.length === filteredIssues.length} 
                            onChange={toggleProjectSelectAll} 
                            className="w-4 h-4 rounded"
                            style={{ borderColor: "#c7cad5" }}
                          />
                        </th>
                        <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>ID</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Title</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Type</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Status</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Priority</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Assignees</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wide w-24" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-16" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>
                            No issues found — create your first issue to get started
                          </td>
                        </tr>
                      ) : (
                        filteredIssues.map((issue) => (
                          <tr
                            key={issue.id}
                            className="border-b transition-colors hover:bg-gray-50"
                            style={{ borderColor: "#f5f5f5" }}
                          >
                            <td className="px-5 py-4">
                              <input 
                                type="checkbox" 
                                checked={selectedProjectIssueIds.includes(issue.id)} 
                                onChange={() => toggleProjectIssue(issue.id)} 
                                className="w-4 h-4 rounded"
                                style={{ borderColor: "#c7cad5" }}
                              />
                            </td>
                            <td className="px-5 py-4 text-sm font-mono" style={{ color: "#a5a8b5" }}>
                              #{issue.id}
                            </td>
                            <td className="px-5 py-4 text-sm font-medium" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                              {issue.title}
                            </td>
                            <td className="px-5 py-4">
                              <TypeBadge type={issue.type} />
                            </td>
                            <td className="px-5 py-4">
                              <TypeBadge type={issue.type} />
                            </td>
                            <td className="px-5 py-4">
                              <select
                                value={issue.status}
                                onChange={(e) => handleProjectStatusChange(issue.id, e.target.value)}
                                className="text-sm px-3 py-2 rounded-lg border cursor-pointer bg-white"
                                style={{ borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
                              >
                                {Object.values(ISSUE_STATUSES).map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <PriorityDot priority={issue.priority} />
                                <span className="text-sm" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>{issue.priority}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {issue.assignees.length > 0 ? (
                                <AvatarGroup names={issue.assignees.map((a) => a.user.name)} />
                              ) : (
                                <span className="text-sm" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>Unassigned</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <button
                                onClick={() => router.push(`/issues/${issue.id}`)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md hover:opacity-80 transition-opacity"
                                style={{ background: "#c3faf5", color: "#187574", fontFamily: "DM Sans, sans-serif" }}
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
                      className="flex-shrink-0 w-80 rounded-2xl p-4"
                      style={{ background: "#fafafa" }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-sm" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                          {status}
                        </h3>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full shadow-sm" style={{ background: "#ffffff", color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
                          {statusIssues.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {statusIssues.map((issue) => (
                          <Link
                            key={issue.id}
                            href={`/issues/${issue.id}`}
                            className="block rounded-xl p-4 transition-all duration-200"
                            style={{ background: "#ffffff", border: "1px solid #e9e9e9" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                              e.currentTarget.style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = "none";
                              e.currentTarget.style.transform = "translateY(0)";
                            }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-xs font-mono" style={{ color: "#a5a8b5" }}>
                                #{issue.id}
                              </span>
                              <TypeBadge type={issue.type} />
                            </div>
                            <h4 className="text-sm font-medium mb-3 line-clamp-2" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
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
                <span className="text-[13px]" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
                  Showing {((issuesPaginationState[issueStatusTab] - 1) * issuesPagination.limit) + 1} to {Math.min(issuesPaginationState[issueStatusTab] * issuesPagination.limit, issuesPagination.total)} of {issuesPagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleIssuePageChange(issuesPaginationState[issueStatusTab] - 1)}
                    disabled={issuesPaginationState[issueStatusTab] === 1}
                    className="p-2 rounded-lg border hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-all"
                    style={{ borderColor: "#c7cad5" }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[13px] tabular-nums" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
                    Page {issuesPaginationState[issueStatusTab]} of {issuesPagination.totalPages}
                  </span>
                  <button
                    onClick={() => handleIssuePageChange(issuesPaginationState[issueStatusTab] + 1)}
                    disabled={issuesPaginationState[issueStatusTab] >= issuesPagination.totalPages}
                    className="p-2 rounded-lg border hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-all"
                    style={{ borderColor: "#c7cad5" }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "milestones" && (
          <div>
            <MilestoneList
              milestones={milestones}
              onMilestoneClick={(milestone) => {
                setSelectedMilestone(milestone);
                setShowMilestoneDetailModal(true);
              }}
            />
            <MilestonePagination
              pagination={milestonesPagination}
              onPageChange={handleMilestonePageChange}
            />
          </div>
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
            <div className="p-3 text-sm rounded-md border" style={{ background: "#fbd4d4", color: "#c0392b", borderColor: "#fbd4d4" }}>
              {createError}
            </div>
          )}

          <div className="relative">
            <Input
              id="title"
              label="Title"
              placeholder="Issue title"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              required
            />
            {createForm.title ? (
              <button
                type="button"
                onClick={() => handleRefine("title")}
                disabled={refiningField === "title"}
                className="absolute right-2 top-9 p-1.5 hover:opacity-80 disabled:opacity-50 touch-target z-10"
                style={{ color: "#555a6a" }}
                title="AI Refine"
              >
                <Sparkles className={`w-4 h-4 ${refiningField === "title" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSuggest("title")}
                disabled={refiningField === "title"}
                className="absolute right-2 top-9 p-1.5 hover:opacity-80 disabled:opacity-50 touch-target z-10"
                style={{ color: "#555a6a" }}
                title="AI Suggest"
              >
                <Wand2 className={`w-4 h-4 ${refiningField === "title" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              id="type"
              label="Type"
              options={Object.values(ISSUE_TYPES).map((t) => ({ value: t, label: t }))}
              value={createForm.type}
              onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
            />
            <Select
              id="priority"
              label="Priority"
              options={Object.values(ISSUE_PRIORITIES).map((p) => ({ value: p, label: p }))}
              value={createForm.priority}
              onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                Description
              </label>
              {createForm.description ? (
                <button
                  type="button"
                  onClick={() => handleRefine("description")}
                  disabled={refiningField === "description"}
                  className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                  style={{ color: "#5b76fe", fontFamily: "DM Sans, sans-serif" }}
                  title="AI Refine"
                >
                  <Sparkles className={`w-3 h-3 ${refiningField === "description" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
                  {refiningField === "description" ? "Refining..." : "AI Refine"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSuggest("description")}
                  disabled={refiningField === "description"}
                  className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                  style={{ color: "#5b76fe", fontFamily: "DM Sans, sans-serif" }}
                  title="AI Suggest"
                >
                  <Wand2 className={`w-3 h-3 ${refiningField === "description" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
                  {refiningField === "description" ? "Suggesting..." : "AI Suggest"}
                </button>
              )}
            </div>
            <textarea
              className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none resize-none"
              style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
              placeholder="Describe the issue... (Markdown supported)"
              rows={4}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
          </div>

          {createForm.type === "Bug" && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                    Steps to Reproduce
                  </label>
                  {createForm.stepsToReproduce ? (
                    <button
                      type="button"
                      onClick={() => handleRefine("stepsToReproduce")}
                      disabled={refiningField === "stepsToReproduce"}
                      className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                      style={{ color: "#5b76fe", fontFamily: "DM Sans, sans-serif" }}
                      title="AI Refine"
                    >
                      <Sparkles className={`w-3 h-3 ${refiningField === "stepsToReproduce" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
                      {refiningField === "stepsToReproduce" ? "Refining..." : "AI Refine"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSuggest("stepsToReproduce")}
                      disabled={refiningField === "stepsToReproduce"}
                      className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                      style={{ color: "#5b76fe", fontFamily: "DM Sans, sans-serif" }}
                      title="AI Suggest"
                    >
                      <Wand2 className={`w-3 h-3 ${refiningField === "stepsToReproduce" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
                      {refiningField === "stepsToReproduce" ? "Suggesting..." : "AI Suggest"}
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none resize-none"
                  style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error... (Markdown supported)"
                  rows={4}
                  value={createForm.stepsToReproduce}
                  onChange={(e) => setCreateForm({ ...createForm, stepsToReproduce: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                    Expected Result
                  </label>
                  {createForm.expectedResult ? (
                    <button
                      type="button"
                      onClick={() => handleRefine("expectedResult")}
                      disabled={refiningField === "expectedResult"}
                      className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                      style={{ color: "#5b76fe", fontFamily: "DM Sans, sans-serif" }}
                      title="AI Refine"
                    >
                      <Sparkles className={`w-3 h-3 ${refiningField === "expectedResult" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
                      {refiningField === "expectedResult" ? "Refining..." : "AI Refine"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSuggest("expectedResult")}
                      disabled={refiningField === "expectedResult"}
                      className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                      style={{ color: "#5b76fe", fontFamily: "DM Sans, sans-serif" }}
                      title="AI Suggest"
                    >
                      <Wand2 className={`w-3 h-3 ${refiningField === "expectedResult" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
                      {refiningField === "expectedResult" ? "Suggesting..." : "AI Suggest"}
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none resize-none"
                  style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
                  placeholder="What should happen... (Markdown supported)"
                  rows={2}
                  value={createForm.expectedResult}
                  onChange={(e) => setCreateForm({ ...createForm, expectedResult: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                    Actual Result
                  </label>
                  {createForm.actualResult ? (
                    <button
                      type="button"
                      onClick={() => handleRefine("actualResult")}
                      disabled={refiningField === "actualResult"}
                      className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                      style={{ color: "#5b76fe", fontFamily: "DM Sans, sans-serif" }}
                      title="AI Refine"
                    >
                      <Sparkles className={`w-3 h-3 ${refiningField === "actualResult" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
                      {refiningField === "actualResult" ? "Refining..." : "AI Refine"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSuggest("actualResult")}
                      disabled={refiningField === "actualResult"}
                      className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                      style={{ color: "#5b76fe", fontFamily: "DM Sans, sans-serif" }}
                      title="AI Suggest"
                    >
                      <Wand2 className={`w-3 h-3 ${refiningField === "actualResult" ? "animate-pulse" : ""}`} style={{ color: "#5b76fe" }} />
                      {refiningField === "actualResult" ? "Suggesting..." : "AI Suggest"}
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none resize-none"
                  style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
                  placeholder="What actually happens... (Markdown supported)"
                  rows={2}
                  value={createForm.actualResult}
                  onChange={(e) => setCreateForm({ ...createForm, actualResult: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                Start Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none"
                style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
                value={createForm.startDate}
                onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                Due Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none"
                style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
                value={createForm.dueDate}
                onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div onPaste={handleScreenshotPaste}>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
              Screenshots
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {screenshots.map((s, index) => (
                <div key={index} className="relative w-16 h-16 rounded overflow-hidden border group cursor-pointer hover:border-[#5b76fe] transition-all" style={{ borderColor: "#c7cad5" }}>
                  <img
                    src={s.preview}
                    alt={`screenshot-${index}`}
                    className="w-full h-full object-cover"
                    onClick={() => setPreviewImage(s.preview)}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeScreenshot(index); }}
                    className="absolute top-0 right-0 p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(0,0,0,0.5)", color: "#ffffff" }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:border-[#5b76fe] hover:text-[#5b76fe] transition-all" style={{ borderColor: "#c7cad5", color: "#555a6a" }}>
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
            <p className="text-[10px] mt-1 text-center" style={{ color: "#a5a8b5" }}>or paste with Ctrl+V</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} style={{ border: "1px solid #c7cad5", borderRadius: "8px", fontFamily: "DM Sans, sans-serif" }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating} style={{ background: "#5b76fe", borderRadius: "8px", fontFamily: "DM Sans, sans-serif" }}>
              {isCreating ? "Creating..." : "Create Issue"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Screenshot Preview Overlay */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center cursor-pointer"
          style={{ background: "rgba(0,0,0,0.90)" }}
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full hover:opacity-80 transition-opacity"
            style={{ color: "#ffffff", background: "rgba(255,255,255,0.2)" }}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Create Milestone Modal */}
      <CreateMilestoneModal
        isOpen={showCreateMilestoneModal}
        onClose={() => setShowCreateMilestoneModal(false)}
        onCreate={handleCreateMilestone}
        isCreating={isCreatingMilestone}
      />

      {/* Milestone Detail Modal */}
      {selectedMilestone && (
        <MilestoneDetailModal
          isOpen={showMilestoneDetailModal}
          onClose={() => setShowMilestoneDetailModal(false)}
          milestone={selectedMilestone}
          onUpdate={handleUpdateMilestone}
          onToggleChecklistItem={handleToggleChecklistItem}
          onAddNote={handleAddMilestoneNote}
          canEdit={user?.role === "Admin"}
          isUpdating={isUpdatingMilestone}
          isAddingNote={isAddingMilestoneNote}
        />
      )}
    </div>
  );
}
