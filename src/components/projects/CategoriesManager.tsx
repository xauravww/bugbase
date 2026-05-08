"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { contrastingText } from "@/lib/categories";

export interface Category {
  id: number;
  projectId: number;
  name: string;
  color: string;
}

interface Props {
  projectId: number;
  canEdit: boolean;
  onChange?: (categories: Category[]) => void;
}

const DEFAULT_NEW_COLOR = "#5b76fe";

export default function CategoriesManager({ projectId, canEdit, onChange }: Props) {
  const { token } = useAuth();
  const [list, setList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_NEW_COLOR);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load categories");
        return;
      }
      setList(data.categories || []);
      onChange?.(data.categories || []);
    } catch (e) {
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [projectId, token, onChange]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/categories`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create");
        return;
      }
      setNewName("");
      setNewColor(DEFAULT_NEW_COLOR);
      await fetchCategories();
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleSave = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    setSavingId(id);
    setError("");
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: editColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update");
        return;
      }
      setEditingId(null);
      await fetchCategories();
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this category? It will be removed from all issues.")) return;
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to delete");
        return;
      }
      await fetchCategories();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="rounded-2xl border p-5 md:p-6 max-w-3xl"
      style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "#1c1c1e" }}>
            Categories
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "#555a6a" }}>
            Tag issues by area (Homepage, Auth, Forms\u2026) and filter by one or more.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 px-3 py-2 rounded-lg text-sm"
          style={{ background: "#fdecec", color: "#eb5757" }}
        >
          {error}
        </div>
      )}

      {canEdit && (
        <div
          className="flex items-center gap-2 mb-5 p-3 rounded-xl"
          style={{ background: "#f7f6f3" }}
        >
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-9 h-9 rounded cursor-pointer border-0"
            aria-label="New category color"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            maxLength={50}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:border-[#5b76fe]"
            style={{ background: "#ffffff", borderColor: "#e9eaef" }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
            style={{ background: "#5b76fe", color: "#ffffff" }}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm py-8 text-center" style={{ color: "#a5a8b5" }}>
          Loading categories...
        </div>
      ) : list.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: "#a5a8b5" }}>
          No categories yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((cat) => {
            const isEditing = editingId === cat.id;
            const fg = contrastingText(cat.color);
            return (
              <li
                key={cat.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border"
                style={{ background: "#ffffff", borderColor: "#e9eaef" }}
              >
                {isEditing ? (
                  <>
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={50}
                      className="flex-1 px-2 py-1.5 text-sm rounded border focus:outline-none focus:border-[#5b76fe]"
                      style={{ borderColor: "#e9eaef" }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSave(cat.id)}
                      disabled={savingId === cat.id}
                      className="p-1.5 rounded hover:bg-[#f7f6f3]"
                      aria-label="Save"
                    >
                      {savingId === cat.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#5b76fe" }} />
                      ) : (
                        <Check className="w-4 h-4" style={{ color: "#22c55e" }} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1.5 rounded hover:bg-[#f7f6f3]"
                      aria-label="Cancel"
                    >
                      <X className="w-4 h-4" style={{ color: "#a5a8b5" }} />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: cat.color, color: fg }}
                    >
                      {cat.name}
                    </span>
                    <span className="text-xs" style={{ color: "#a5a8b5" }}>
                      {cat.color.toUpperCase()}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            className="p-1.5 rounded hover:bg-[#f7f6f3]"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" style={{ color: "#555a6a" }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat.id)}
                            disabled={deletingId === cat.id}
                            className="p-1.5 rounded hover:bg-[#fdecec]"
                            aria-label="Delete"
                          >
                            {deletingId === cat.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#eb5757" }} />
                            ) : (
                              <Trash2 className="w-4 h-4" style={{ color: "#eb5757" }} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
