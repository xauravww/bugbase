"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, FolderKanban, Users, Bug, Archive, Search, ChevronLeft, ChevronRight, Calendar, Pencil, X } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Modal, Input, PageLoader, Badge, Avatar, Select } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useClickOutside } from "@/hooks/useClickOutside";

interface Project {
  id: number;
  name: string;
  key: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  archived: boolean;
  issueCount: number;
  openIssueCount: number;
  members: Array<{ user: { id: number; name: string; email: string }; role: string }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ProjectsPage() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", startDate: "", endDate: "", archived: false });
  const [projectMembers, setProjectMembers] = useState<Array<{ user: { id: number; name: string; email: string }; role: string }>>([]);
  const [selectedQA, setSelectedQA] = useState<string>("");
  const [qaSearch, setQaSearch] = useState("");
  const [qaUsers, setQaUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [showQaDropdown, setShowQaDropdown] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberUsers, setMemberUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState({ name: "", key: "", description: "", startDate: "", endDate: "" });
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState("");

  const qaDropdownRef = useClickOutside<HTMLDivElement>(() => setShowQaDropdown(false));
  const memberDropdownRef = useClickOutside<HTMLDivElement>(() => setShowMemberDropdown(false));

  const fetchProjects = useCallback(async (searchTerm: string = "", page: number = 1) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/projects?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchProjects(search, pagination.page);
    }
  }, [token, pagination.page]);

  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const timer = setTimeout(() => {
      if (token) {
        fetchProjects(search, 1);
        setPagination(p => ({ ...p, page: 1 }));
      }
    }, 300);
    setSearchTimeout(timer);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setIsCreating(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");

      setShowCreateModal(false);
      setCreateForm({ name: "", key: "", description: "", startDate: "", endDate: "" });
      fetchProjects(search, pagination.page);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = async (project: Project) => {
    setEditingProject(project);
    setEditForm({
      name: project.name,
      description: project.description || "",
      startDate: project.startDate ? project.startDate.split('T')[0] : "",
      endDate: project.endDate ? project.endDate.split('T')[0] : "",
      archived: project.archived,
    });
    setProjectMembers(project.members);
    setQaSearch("");
    setShowQaDropdown(false);
    setMemberSearch("");
    setShowMemberDropdown(false);
    setSelectedMembers([]);

    // Find current QA
    const qa = project.members.find(m => m.role === "qa");
    setSelectedQA(qa?.user.id.toString() || "");
    setQaSearch(qa?.user.name || "");

    // Find current members (non-qa, non-admin)
    const members = project.members.filter(m => m.role === "member").map(m => m.user.id.toString());
    setSelectedMembers(members);
    setMemberSearch(project.members.filter(m => m.role === "member").map(m => m.user.name).join(", "));

    // Fetch all users and filter for QA role
    try {
      const res = await fetch("/api/users?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Filter users with QA role (case-insensitive)
        const qaList = (data.users || []).filter((u: { role: string }) => u.role?.toLowerCase() === "qa");
        setQaUsers(qaList);
        // Get all users for member selection (excluding admins and qa from global roles)
        const allUsers = (data.users || []).filter((u: { role: string }) => 
          u.role?.toLowerCase() !== "admin"
        );
        setMemberUsers(allUsers);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }

    setShowEditModal(true);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    setEditError("");
    setIsEditing(true);

    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          startDate: editForm.startDate || null,
          endDate: editForm.endDate || null,
          archived: editForm.archived,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update project");

      // Update QA member
      const currentQa = projectMembers.find(m => m.role === "qa");
      const newQaId = selectedQA ? parseInt(selectedQA) : null;

      if (currentQa && currentQa.user.id !== newQaId) {
        // Remove old QA
        await fetch(`/api/projects/${editingProject.id}/members?userId=${currentQa.user.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (newQaId && (!currentQa || currentQa.user.id !== newQaId)) {
        // Add new QA
        await fetch(`/api/projects/${editingProject.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: newQaId, role: "qa" }),
        });
      }

      // Update project members
      const currentMembers = projectMembers.filter(m => m.role === "member").map(m => m.user.id);
      const newMemberIds = selectedMembers.map(id => parseInt(id));

      // Remove members that are no longer selected
      for (const userId of currentMembers) {
        if (!newMemberIds.includes(userId)) {
          await fetch(`/api/projects/${editingProject.id}/members?userId=${userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      // Add new members
      for (const userId of newMemberIds) {
        if (!currentMembers.includes(userId)) {
          await fetch(`/api/projects/${editingProject.id}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userId, role: "member" }),
          });
        }
      }

      setShowEditModal(false);
      setEditingProject(null);
      fetchProjects(search, pagination.page);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setIsEditing(false);
    }
  };

  const generateKey = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <Header title="Projects">
        {user?.role === "Admin" && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            <span className="mobile-hidden">New Project</span>
            <span className="desktop-hidden">New</span>
          </Button>
        )}
      </Header>

      <div className="p-4 max-w-[1100px]">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16">
            <FolderKanban className="w-12 h-12 text-[var(--color-text-placeholder)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
              No projects found
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {search ? "Try a different search term" : (user?.role === "Admin" ? "Create your first project" : "You haven't been added to any projects")}
            </p>
            {!search && user?.role === "Admin" && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                <span className="mobile-hidden">Create Project</span>
                <span className="desktop-hidden">Create</span>
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile view */}
            <div className="md:hidden space-y-4">
              {projects.map((project) => {
                const isAdmin = project.members.some(m => m.user.id === user?.id && m.role === "admin") || user?.role === "Admin";
                return (
                  <div
                    key={project.id}
                    className="relative bg-white border border-[var(--color-border)] rounded-lg p-4"
                  >
                    <Link href={`/projects/${project.id}`} className="block">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-[var(--color-text-primary)]">{project.name}</h3>
                          <Badge variant="default" className="mt-1">{project.key}</Badge>
                        </div>
                        {project.archived && <Archive className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                      </div>

                      {project.description && (
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">{project.description}</p>
                      )}

                      {(project.startDate || project.endDate) && (
                        <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] mb-3">
                          <Calendar className="w-3 h-3" />
                          {formatDate(project.startDate)} - {formatDate(project.endDate)}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                          <span className="flex items-center gap-1"><Bug className="w-4 h-4" />{project.openIssueCount} open</span>
                          <span className="flex items-center gap-1"><Users className="w-4 h-4" />{project.members.length}</span>
                        </div>
                      </div>
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.preventDefault(); openEditModal(project); }}
                        className="absolute top-2 right-2 p-1.5 rounded bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop view */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => {
                const isAdmin = project.members.some(m => m.user.id === user?.id && m.role === "admin") || user?.role === "Admin";
                return (
                  <div
                    key={project.id}
                    className="relative group bg-white border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-accent)] transition-colors"
                  >
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.preventDefault(); openEditModal(project); }}
                        className="absolute top-2 right-2 p-1.5 rounded bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <Link href={`/projects/${project.id}`} className="block">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-[var(--color-text-primary)]">{project.name}</h3>
                          <Badge variant="default" className="mt-1">{project.key}</Badge>
                        </div>
                        {project.archived && <Archive className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                      </div>

                      {project.description && (
                        <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2">{project.description}</p>
                      )}

                      {(project.startDate || project.endDate) && (
                        <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] mb-3">
                          <Calendar className="w-3 h-3" />
                          {formatDate(project.startDate)} - {formatDate(project.endDate)}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4 text-[var(--color-text-secondary)]">
                          <span className="flex items-center gap-1"><Bug className="w-4 h-4" />{project.openIssueCount} open</span>
                          <span className="flex items-center gap-1 hidden sm:flex"><Users className="w-4 h-4" />{project.members.length}</span>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
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
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
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
          </>
        )}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Project">
        <form onSubmit={handleCreateProject} className="space-y-4">
          {createError && (
            <div className="p-3 text-sm text-[var(--color-danger)] bg-red-50 rounded-md border border-red-100">{createError}</div>
          )}

          <Input id="name" label="Project Name" placeholder="My Project" value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value, key: createForm.key || generateKey(e.target.value) })} required />

          <Input id="key" label="Project Key" placeholder="PROJ" value={createForm.key}
            onChange={(e) => setCreateForm({ ...createForm, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} maxLength={10} required />

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Description</label>
            <textarea id="description" className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none" rows={3} placeholder="What is this project about?"
              value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Start Date</label>
              <input type="date" id="startDate" className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] touch-target"
                value={createForm.startDate} onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">End Date</label>
              <input type="date" id="endDate" className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] touch-target"
                value={createForm.endDate} onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isCreating}>{isCreating ? "Creating..." : "Create Project"}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Project">
        <form onSubmit={handleUpdateProject} className="space-y-4">
          {editError && (
            <div className="p-3 text-sm text-[var(--color-danger)] bg-red-50 rounded-md border border-red-100">{editError}</div>
          )}

          <Input id="editName" label="Project Name" value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />

          <div>
            <label htmlFor="editDescription" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Description</label>
            <textarea id="editDescription" className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none" rows={3}
              value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="editStartDate" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Start Date</label>
              <input type="date" id="editStartDate" className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] touch-target"
                value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor="editEndDate" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">End Date</label>
              <input type="date" id="editEndDate" className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] touch-target"
                value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
            </div>
          </div>

          <div className="relative" ref={qaDropdownRef}>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Assign QA</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search QA..."
                value={qaSearch}
                onChange={(e) => { setQaSearch(e.target.value); setShowQaDropdown(true); }}
                onFocus={() => setShowQaDropdown(true)}
                className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] touch-target"
              />
              {selectedQA && (
                <button
                  type="button"
                  onClick={() => { setSelectedQA(""); setShowQaDropdown(false); setQaSearch(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {showQaDropdown && qaUsers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--color-border)] rounded-md shadow-lg max-h-48 overflow-auto">
                {qaUsers
                  .filter(u => u.name.toLowerCase().includes(qaSearch.toLowerCase()) || u.email.toLowerCase().includes(qaSearch.toLowerCase()))
                  .map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelectedQA(u.id.toString()); setShowQaDropdown(false); setQaSearch(""); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface)] ${selectedQA === u.id.toString() ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : ""
                        }`}
                    >
                      {u.name} ({u.email})
                    </button>
                  ))}
              </div>
            )}
            {selectedQA && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(() => {
                  const qa = qaUsers.find(u => u.id.toString() === selectedQA);
                  return qa ? (
                    <span key={qa.id} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded">
                      {qa.name}
                      <button
                        type="button"
                        onClick={() => { setSelectedQA(""); setShowQaDropdown(false); setQaSearch(""); }}
                        className="text-[var(--color-accent)] hover:text-[var(--color-danger)]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          <div className="relative" ref={memberDropdownRef}>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Add Members</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search and add members..."
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setShowMemberDropdown(true); }}
                onFocus={() => setShowMemberDropdown(true)}
                className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] touch-target"
              />
              {selectedMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setSelectedMembers([]); setMemberSearch(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {showMemberDropdown && memberUsers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--color-border)] rounded-md shadow-lg max-h-48 overflow-auto">
                {memberUsers
                  .filter(u => !selectedMembers.includes(u.id.toString()))
                  .filter(u => u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { 
                        const newMembers = [...selectedMembers, u.id.toString()];
                        setSelectedMembers(newMembers); 
                        setMemberSearch("");
                        setShowMemberDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface)]"
                    >
                      {u.name} ({u.email})
                    </button>
                  ))}
              </div>
            )}
            {selectedMembers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedMembers.map(memberId => {
                  const member = memberUsers.find(u => u.id.toString() === memberId);
                  return member ? (
                    <span key={memberId} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[var(--color-surface)] rounded">
                      {member.name}
                      <button
                        type="button"
                        onClick={() => {
                          const newMembers = selectedMembers.filter(id => id !== memberId);
                          setSelectedMembers(newMembers);
                          setMemberSearch("");
                        }}
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="archived"
              checked={editForm.archived}
              onChange={(e) => setEditForm({ ...editForm, archived: e.target.checked })}
              className="rounded touch-target"
            />
            <label htmlFor="archived" className="text-sm text-[var(--color-text-primary)]">Archive this project</label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isEditing}>{isEditing ? "Saving..." : "Save Changes"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
