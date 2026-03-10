"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, List, LayoutGrid, ChevronLeft, ChevronRight, Image, X, Download, Flag, Sparkles, Wand2, Clipboard, Check, ExternalLink } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Modal, Input, Select, PageLoader, StatusBadge, TypeBadge, PriorityDot, AvatarGroup } from "@/components/ui";
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
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [activeTab, setActiveTab] = useState<"issues" | "milestones">("issues");
  const [issueStatusTab, setIssueStatusTab] = useState<string>("all");
  const [issuesPaginationState, setIssuesPaginationState] = useState<Record<string, number>>({ all: 1, Open: 1, "In Progress": 1, "In Review": 1, Verified: 1, Closed: 1 });
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
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
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
        for (const url of screenshots) {
          await fetch(`/api/issues/${data.issue.id}/attachments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url }),
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

    setIsUploading(true);
    try {
      const data = await uploadImageFile(file);
      if (data) {
        setScreenshots(prev => [...prev, data.url]);
      }
    } catch (error) {
      console.error("Failed to upload:", error);
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
        setIsUploading(true);
        try {
          const data = await uploadImageFile(file);
          if (data) {
            setScreenshots(prev => [...prev, data.url]);
          }
        } finally {
          setIsUploading(false);
        }
        return;
      }
    }
  };

  const removeScreenshot = (index: number) => {
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
        if (issue.isVerified) lines.push(`Verified: Yes`);
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
    <div>
      <Header title={project.name} searchValue={issueSearch} onSearchChange={setIssueSearch} searchPlaceholder="Search by title or issue number (e.g. #8)...">
        {/* Desktop controls in header */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex bg-[var(--color-surface)] rounded-md p-1">
            <button
              onClick={() => setActiveTab("issues")}
              className={`px-3 py-1.5 text-sm rounded touch-target ${activeTab === "issues" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
            >
              <List className="w-4 h-4" />
              <span className="ml-1">Issues</span>
            </button>
            <button
              onClick={() => setActiveTab("milestones")}
              className={`px-3 py-1.5 text-sm rounded touch-target ${activeTab === "milestones" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
            >
              <Flag className="w-4 h-4" />
              <span className="ml-1">Milestones</span>
            </button>
          </div>
          {activeTab === "issues" && (
            <>
              <div className="flex bg-[var(--color-surface)] rounded-md p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-sm rounded touch-target ${viewMode === "list" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("board")}
                  className={`px-3 py-1.5 text-sm rounded touch-target ${viewMode === "board" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
              {canCreateIssue && (
                <Button onClick={() => setShowCreateModal(true)} className="touch-target">
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="mobile-hidden">New Issue</span>
                  <span className="desktop-hidden">New</span>
                </Button>
              )}
            </>
          )}
          {activeTab === "milestones" && user?.role === "Admin" && (
            <Button onClick={() => setShowCreateMilestoneModal(true)} className="touch-target">
              <Plus className="w-4 h-4 mr-2" />
              <span className="mobile-hidden">New Milestone</span>
              <span className="desktop-hidden">New</span>
            </Button>
          )}
        </div>
        {/* Mobile: just show create button in header */}
        <div className="md:hidden flex items-center gap-1">
          {activeTab === "issues" && canCreateIssue && (
            <Button onClick={() => setShowCreateModal(true)} className="touch-target px-2">
              <Plus className="w-4 h-4" />
            </Button>
          )}
          {activeTab === "milestones" && user?.role === "Admin" && (
            <Button onClick={() => setShowCreateMilestoneModal(true)} className="touch-target px-2">
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Header>

      <div className="p-6 mobile-p-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-4">
          <Link href="/projects" className="hover:text-[var(--color-accent)] flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            <span className="mobile-hidden">Projects</span>
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] truncate">{project.name}</span>
        </div>

        {/* Mobile Controls - Tabs and View Mode */}
        <div className="md:hidden mb-4 space-y-3">
          {/* Tabs */}
          <div className="flex bg-[var(--color-surface)] rounded-md p-1">
            <button
              onClick={() => setActiveTab("issues")}
              className={`flex-1 px-3 py-2 text-sm rounded touch-target flex items-center justify-center gap-1 ${activeTab === "issues" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
            >
              <List className="w-4 h-4" />
              <span>Issues</span>
            </button>
            <button
              onClick={() => setActiveTab("milestones")}
              className={`flex-1 px-3 py-2 text-sm rounded touch-target flex items-center justify-center gap-1 ${activeTab === "milestones" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
            >
              <Flag className="w-4 h-4" />
              <span>Milestones</span>
            </button>
          </div>
          {/* View Mode Toggle - only show for issues */}
          {activeTab === "issues" && (
            <div className="flex items-center justify-between">
              <div className="flex bg-[var(--color-surface)] rounded-md p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-sm rounded touch-target flex items-center gap-1 ${viewMode === "list" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
                >
                  <List className="w-4 h-4" />
                  <span>List</span>
                </button>
                <button
                  onClick={() => setViewMode("board")}
                  className={`px-3 py-1.5 text-sm rounded touch-target flex items-center gap-1 ${viewMode === "board" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Board</span>
                </button>
              </div>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {issuesPagination.total} issue{issuesPagination.total !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {activeTab === "issues" && (
          <>
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
                    onClick={() => setIssueStatusTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      issueStatusTab === tab.key
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6 mobile-flex-col">
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  options={[
                    { value: "all", label: "All Types" },
                    ...Object.values(ISSUE_TYPES).map((t) => ({ value: t, label: t })),
                  ]}
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value); setIssuesPaginationState(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 1]))); }}
                  className="w-32 mobile-full-width"
                />
                <Select
                  options={[
                    { value: "all", label: "All Priorities" },
                    ...Object.values(ISSUE_PRIORITIES).map((p) => ({ value: p, label: p })),
                  ]}
                  value={filterPriority}
                  onChange={(e) => { setFilterPriority(e.target.value); setIssuesPaginationState(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 1]))); }}
                  className="w-36 mobile-full-width"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
                  {issuesPagination.total} issue{issuesPagination.total !== 1 ? "s" : ""}
                </span>
                <Button
                  variant="secondary"
                  onClick={handleCopyAllIssues}
                  className="flex items-center gap-2 touch-target"
                  disabled={filteredIssues.length === 0 || isCopying}
                >
                  {copiedIssues ? <Check className="w-4 h-4 text-green-600" /> : <Clipboard className="w-4 h-4" />}
                  <span className="mobile-hidden">{isCopying ? "Copying..." : copiedIssues ? "Copied!" : "Copy All"}</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleExportPdf}
                  className="flex items-center gap-2 ml-auto touch-target"
                >
                  <Download className="w-4 h-4" />
                  <span className="mobile-hidden">Export PDF</span>
                </Button>
              </div>
            </div>

            {/* Bulk status update bar */}
            {selectedProjectIssueIds.length > 0 && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-[var(--color-accent-light,#e8f0fb)] border border-[var(--color-accent)] rounded-lg">
                <span className="text-sm font-medium">{selectedProjectIssueIds.length} selected</span>
                <Select
                  options={[
                    { value: "", label: "Change status to..." },
                    ...Object.values(ISSUE_STATUSES).map(s => ({ value: s, label: s })),
                  ]}
                  value={bulkProjectStatus}
                  onChange={(e) => setBulkProjectStatus(e.target.value)}
                  className="w-44"
                />
                <Button variant="primary" onClick={handleBulkProjectStatusUpdate} disabled={!bulkProjectStatus} className="text-sm">
                  Update
                </Button>
                <button onClick={() => setSelectedProjectIssueIds([])} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ml-auto">
                  Clear
                </button>
              </div>
            )}

            {/* List View */}
            {viewMode === "list" && (
              <div className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                        <th className="text-left px-4 py-3 w-10">
                          <input type="checkbox" checked={filteredIssues.length > 0 && selectedProjectIssueIds.length === filteredIssues.length} onChange={toggleProjectSelectAll} className="w-4 h-4 rounded border-[var(--color-border)]" />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">ID</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Title</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Priority</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Assignees</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-[var(--color-text-secondary)]">
                            No issues found
                          </td>
                        </tr>
                      ) : (
                        filteredIssues.map((issue) => (
                          <tr
                            key={issue.id}
                            className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                          >
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={selectedProjectIssueIds.includes(issue.id)} onChange={() => toggleProjectIssue(issue.id)} className="w-4 h-4 rounded border-[var(--color-border)]" />
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-[var(--color-text-secondary)]">
                              #{issue.id}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
                              {issue.title}
                            </td>
                            <td className="px-4 py-3">
                              <TypeBadge type={issue.type} />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={issue.status}
                                onChange={(e) => handleProjectStatusChange(issue.id, e.target.value)}
                                className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-white cursor-pointer"
                              >
                                {Object.values(ISSUE_STATUSES).map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <PriorityDot priority={issue.priority} />
                                <span className="text-sm text-[var(--color-text-secondary)]">{issue.priority}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {issue.assignees.length > 0 ? (
                                <AvatarGroup names={issue.assignees.map((a) => a.user.name)} />
                              ) : (
                                <span className="text-sm text-[var(--color-text-placeholder)]">Unassigned</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => window.open(`/issues/${issue.id}`, "_blank")}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent-light,#e8f0fb)] rounded-md hover:opacity-80 transition-opacity"
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
                      className="flex-shrink-0 w-72 bg-[var(--color-surface)] rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-sm text-[var(--color-text-primary)]">
                          {status}
                        </h3>
                        <span className="text-xs text-[var(--color-text-secondary)] bg-white px-2 py-0.5 rounded">
                          {statusIssues.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {statusIssues.map((issue) => (
                          <Link
                            key={issue.id}
                            href={`/issues/${issue.id}`}
                            className="block bg-white border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-accent)] transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                                #{issue.id}
                              </span>
                              <TypeBadge type={issue.type} />
                            </div>
                            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2 line-clamp-2">
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
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Showing {((issuesPaginationState[issueStatusTab] - 1) * issuesPagination.limit) + 1} to {Math.min(issuesPaginationState[issueStatusTab] * issuesPagination.limit, issuesPagination.total)} of {issuesPagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleIssuePageChange(issuesPaginationState[issueStatusTab] - 1)}
                    disabled={issuesPaginationState[issueStatusTab] === 1}
                    className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Page {issuesPaginationState[issueStatusTab]} of {issuesPagination.totalPages}
                  </span>
                  <button
                    onClick={() => handleIssuePageChange(issuesPaginationState[issueStatusTab] + 1)}
                    disabled={issuesPaginationState[issueStatusTab] >= issuesPagination.totalPages}
                    className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed touch-target"
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
        onClose={() => { setShowCreateModal(false); setScreenshots([]); }}
        title="Create New Issue"
      >
        <form onSubmit={handleCreateIssue} className="space-y-4">
          {createError && (
            <div className="p-3 text-sm text-[var(--color-danger)] bg-red-50 rounded-md border border-red-100">
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
                className="absolute right-2 top-9 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] disabled:opacity-50 touch-target z-10"
                title="AI Refine"
              >
                <Sparkles className={`w-4 h-4 ${refiningField === "title" ? "animate-pulse" : ""}`} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSuggest("title")}
                disabled={refiningField === "title"}
                className="absolute right-2 top-9 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] disabled:opacity-50 touch-target z-10"
                title="AI Suggest"
              >
                <Wand2 className={`w-4 h-4 ${refiningField === "title" ? "animate-pulse" : ""}`} />
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
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                Description
              </label>
              {createForm.description ? (
                <button
                  type="button"
                  onClick={() => handleRefine("description")}
                  disabled={refiningField === "description"}
                  className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                  title="AI Refine"
                >
                  <Sparkles className={`w-3 h-3 ${refiningField === "description" ? "animate-pulse" : ""}`} />
                  {refiningField === "description" ? "Refining..." : "AI Refine"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSuggest("description")}
                  disabled={refiningField === "description"}
                  className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                  title="AI Suggest"
                >
                  <Wand2 className={`w-3 h-3 ${refiningField === "description" ? "animate-pulse" : ""}`} />
                  {refiningField === "description" ? "Suggesting..." : "AI Suggest"}
                </button>
              )}
            </div>
            <textarea
              className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
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
                  <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                    Steps to Reproduce
                  </label>
                  {createForm.stepsToReproduce ? (
                    <button
                      type="button"
                      onClick={() => handleRefine("stepsToReproduce")}
                      disabled={refiningField === "stepsToReproduce"}
                      className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                      title="AI Refine"
                    >
                      <Sparkles className={`w-3 h-3 ${refiningField === "stepsToReproduce" ? "animate-pulse" : ""}`} />
                      {refiningField === "stepsToReproduce" ? "Refining..." : "AI Refine"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSuggest("stepsToReproduce")}
                      disabled={refiningField === "stepsToReproduce"}
                      className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                      title="AI Suggest"
                    >
                      <Wand2 className={`w-3 h-3 ${refiningField === "stepsToReproduce" ? "animate-pulse" : ""}`} />
                      {refiningField === "stepsToReproduce" ? "Suggesting..." : "AI Suggest"}
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error... (Markdown supported)"
                  rows={4}
                  value={createForm.stepsToReproduce}
                  onChange={(e) => setCreateForm({ ...createForm, stepsToReproduce: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                    Expected Result
                  </label>
                  {createForm.expectedResult ? (
                    <button
                      type="button"
                      onClick={() => handleRefine("expectedResult")}
                      disabled={refiningField === "expectedResult"}
                      className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                      title="AI Refine"
                    >
                      <Sparkles className={`w-3 h-3 ${refiningField === "expectedResult" ? "animate-pulse" : ""}`} />
                      {refiningField === "expectedResult" ? "Refining..." : "AI Refine"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSuggest("expectedResult")}
                      disabled={refiningField === "expectedResult"}
                      className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                      title="AI Suggest"
                    >
                      <Wand2 className={`w-3 h-3 ${refiningField === "expectedResult" ? "animate-pulse" : ""}`} />
                      {refiningField === "expectedResult" ? "Suggesting..." : "AI Suggest"}
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="What should happen... (Markdown supported)"
                  rows={2}
                  value={createForm.expectedResult}
                  onChange={(e) => setCreateForm({ ...createForm, expectedResult: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                    Actual Result
                  </label>
                  {createForm.actualResult ? (
                    <button
                      type="button"
                      onClick={() => handleRefine("actualResult")}
                      disabled={refiningField === "actualResult"}
                      className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                      title="AI Refine"
                    >
                      <Sparkles className={`w-3 h-3 ${refiningField === "actualResult" ? "animate-pulse" : ""}`} />
                      {refiningField === "actualResult" ? "Refining..." : "AI Refine"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSuggest("actualResult")}
                      disabled={refiningField === "actualResult"}
                      className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                      title="AI Suggest"
                    >
                      <Wand2 className={`w-3 h-3 ${refiningField === "actualResult" ? "animate-pulse" : ""}`} />
                      {refiningField === "actualResult" ? "Suggesting..." : "AI Suggest"}
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
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
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                value={createForm.startDate}
                onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                value={createForm.dueDate}
                onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div onPaste={handleScreenshotPaste}>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Screenshots
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {screenshots.map((url, index) => (
                <div key={index} className="relative w-16 h-16 rounded overflow-hidden border border-[var(--color-border)]">
                  <img src={url} alt={`screenshot-${index}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeScreenshot(index)}
                    className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer">
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
            <p className="text-[10px] text-[var(--color-text-placeholder)] mt-1 text-center">or paste with Ctrl+V</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Issue"}
            </Button>
          </div>
        </form>
      </Modal>

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
