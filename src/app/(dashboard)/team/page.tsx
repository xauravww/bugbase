"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Modal, Input, Select, PageLoader, Avatar, Badge } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLES } from "@/constants";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function TeamPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Developer",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMembers = useCallback(async (searchTerm: string = "", page: number = 1) => {
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.users || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && user.role !== "Admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    if (token && user?.role === "Admin") {
      fetchMembers(search, pagination.page);
    }
  }, [token, user, pagination.page, fetchMembers, search]);

  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const timer = setTimeout(() => {
      if (token && user?.role === "Admin") {
        fetchMembers(search, 1);
        setPagination(p => ({ ...p, page: 1 }));
      }
    }, 300);
    setSearchTimeout(timer);
    return () => clearTimeout(timer);
  }, [search]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(inviteForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");

      setShowInviteModal(false);
      setInviteForm({ name: "", email: "", password: "", role: "Developer" });
      fetchMembers(search, pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError("");
    setIsSubmitting(true);

    try {
      const updates: Record<string, string> = {
        name: editForm.name,
        role: editForm.role,
      };
      if (editForm.password) updates.password = editForm.password;

      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");

      setShowEditModal(false);
      setSelectedUser(null);
      fetchMembers(search, pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");

      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchMembers(search, pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (member: TeamMember) => {
    setSelectedUser(member);
    setEditForm({ name: member.name, role: member.role, password: "" });
    setError("");
    setShowEditModal(true);
  };

  const openDeleteModal = (member: TeamMember) => {
    setSelectedUser(member);
    setError("");
    setShowDeleteModal(true);
  };

  if (user?.role !== "Admin") return null;
  if (isLoading) return <PageLoader />;

  return (
    <div>
      <Header title="Team">
        <Button onClick={() => setShowInviteModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </Header>

      <div className="p-6 max-w-[1100px]">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-64 pl-10 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-[var(--color-text-placeholder)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
              No team members found
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {search ? "Try a different search term" : "Add your first team member"}
            </p>
            {!search && (
              <Button onClick={() => setShowInviteModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">User</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden md:table-cell">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden lg:table-cell">Joined</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={member.name} size="sm" />
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">
                              {member.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] hidden md:table-cell">
                          {member.email}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="default">{member.role}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] hidden lg:table-cell">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(member)}
                              className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)] rounded"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(member)}
                              className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add User Modal */}
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Add New User">
        <form onSubmit={handleInvite} className="space-y-4">
          {error && <div className="p-3 text-sm text-[var(--color-danger)] bg-red-50 rounded-md border border-red-100">{error}</div>}
          <Input id="name" label="Full Name" placeholder="John Doe" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} required />
          <Input id="email" label="Email" type="email" placeholder="john@example.com" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required />
          <Input id="password" label="Password" type="password" placeholder="Initial password" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} required />
          <Select id="role" label="Role" options={Object.values(USER_ROLES).map((r) => ({ value: r, label: r }))} value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create User"}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit User">
        <form onSubmit={handleEdit} className="space-y-4">
          {error && <div className="p-3 text-sm text-[var(--color-danger)] bg-red-50 rounded-md border border-red-100">{error}</div>}
          <Input id="editName" label="Full Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          <Select id="editRole" label="Role" options={Object.values(USER_ROLES).map((r) => ({ value: r, label: r }))} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} />
          <Input id="editPassword" label="New Password (leave blank to keep current)" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete User Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete User">
        <div className="space-y-4">
          {error && <div className="p-3 text-sm text-[var(--color-danger)] bg-red-50 rounded-md border border-red-100">{error}</div>}
          <p className="text-[var(--color-text-primary)]">
            Are you sure you want to delete <strong>{selectedUser?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button type="button" variant="danger" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete User"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
