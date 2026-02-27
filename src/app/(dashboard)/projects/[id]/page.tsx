"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, List, LayoutGrid, ChevronLeft, Image, X } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Modal, Input, Select, PageLoader, StatusBadge, TypeBadge, PriorityDot, AvatarGroup } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_TYPES } from "@/constants";

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
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
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
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const projectId = resolvedParams.id;

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setIssues(data.issues || []);
      } else if (res.status === 403 || res.status === 404) {
        router.push("/projects");
      }
    } catch (error) {
      console.error("Failed to fetch project:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token && projectId) {
      fetchProject();
    }
  }, [token, projectId]);

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

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setScreenshots([...screenshots, data.url]);
      }
    } catch (error) {
      console.error("Failed to upload:", error);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(screenshots.filter((_, i) => i !== index));
  };

  const filteredIssues = issues.filter((issue) => {
    if (filterType !== "all" && issue.type !== filterType) return false;
    if (filterStatus !== "all" && issue.status !== filterStatus) return false;
    if (filterPriority !== "all" && issue.priority !== filterPriority) return false;
    return true;
  });

  const groupedIssues = Object.values(ISSUE_STATUSES).reduce((acc, status) => {
    acc[status] = filteredIssues.filter((issue) => issue.status === status);
    return acc;
  }, {} as Record<string, Issue[]>);

  const canCreateIssue = user?.role !== "Viewer";

  if (isLoading) {
    return <PageLoader />;
  }

  if (!project) {
    return null;
  }

  return (
    <div>
      <Header title={project.name}>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--color-surface)] rounded-md p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-sm rounded ${viewMode === "list" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`px-3 py-1.5 text-sm rounded ${viewMode === "board" ? "bg-white shadow-sm" : "text-[var(--color-text-secondary)]"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          {canCreateIssue && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Issue
            </Button>
          )}
        </div>
      </Header>

      <div className="p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-4">
          <Link href="/projects" className="hover:text-[var(--color-accent)] flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            Projects
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)]">{project.name}</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <Select
            options={[
              { value: "all", label: "All Types" },
              ...Object.values(ISSUE_TYPES).map((t) => ({ value: t, label: t })),
            ]}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-32"
          />
          <Select
            options={[
              { value: "all", label: "All Statuses" },
              ...Object.values(ISSUE_STATUSES).map((s) => ({ value: s, label: s })),
            ]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-36"
          />
          <Select
            options={[
              { value: "all", label: "All Priorities" },
              ...Object.values(ISSUE_PRIORITIES).map((p) => ({ value: p, label: p })),
            ]}
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-36"
          />
          <span className="text-sm text-[var(--color-text-secondary)]">
            {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <div className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Assignees</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[var(--color-text-secondary)]">
                      No issues found
                    </td>
                  </tr>
                ) : (
                  filteredIssues.map((issue) => (
                    <tr
                      key={issue.id}
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] cursor-pointer"
                      onClick={() => router.push(`/issues/${issue.id}`)}
                    >
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
                        <StatusBadge status={issue.status} />
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Board View */}
        {viewMode === "board" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
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

          <Input
            id="title"
            label="Title"
            placeholder="Issue title"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            required
          />

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
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Description
            </label>
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
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Steps to Reproduce
                </label>
                <textarea
                  className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error... (Markdown supported)"
                  rows={4}
                  value={createForm.stepsToReproduce}
                  onChange={(e) => setCreateForm({ ...createForm, stepsToReproduce: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Expected Result
                </label>
                <textarea
                  className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="What should happen... (Markdown supported)"
                  rows={2}
                  value={createForm.expectedResult}
                  onChange={(e) => setCreateForm({ ...createForm, expectedResult: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Actual Result
                </label>
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

          <div>
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
    </div>
  );
}
