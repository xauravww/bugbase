"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, RefreshCw, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EntryCard } from "./EntryCard";
import { EntryComposer } from "./EntryComposer";
import { TreemapViewer } from "./TreemapViewer";
import type { ContextEntry, ContextKind } from "./types";

interface Props {
  projectId: number;
}

const FILTERS: { key: "all" | ContextKind | "treemap_view"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "feature", label: "Features" },
  { key: "question", label: "Questions" },
  { key: "task", label: "Tasks" },
  { key: "note", label: "Notes" },
  { key: "ingest", label: "Ingest" },
  { key: "treemap_view", label: "Treemap" },
];

const STATUS_FILTERS: { key: "active" | "completed" | "archived" | "all_status"; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
  { key: "all_status", label: "All Status" },
];

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ContextWorkspace({ projectId }: Props) {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const [filter, setFilter] = useState<typeof FILTERS[number]["key"]>("all");
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]["key"]>("active");
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const fetchEntries = useCallback(async (page: number = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (filter !== "all" && filter !== "treemap_view") params.set("kind", filter);
      if (statusFilter !== "all_status") params.set("status", statusFilter);
      const url = `/api/projects/${projectId}/context?${params}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const visible = (data.entries as ContextEntry[]).filter((e) => e.kind !== "treemap" && e.kind !== "ingest_chunk");
        setEntries(visible);
        setPagination(data.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter, projectId, token]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleEditEntry = async (entryId: number, body: string, title: string | null) => {
    if (!token) return;
    const res = await fetch(`/api/projects/${projectId}/context/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ body, title }),
    });
    if (res.ok) await fetchEntries(pagination.page);
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!token) return;
    const res = await fetch(`/api/projects/${projectId}/context/${entryId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await fetchEntries(pagination.page);
  };

  const handleTogglePin = async (entryId: number, pinned: boolean) => {
    if (!token) return;
    await fetch(`/api/projects/${projectId}/context/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pinned }),
    });
    await fetchEntries(pagination.page);
  };

  const handleStatusChange = async (entryId: number, status: "active" | "completed" | "archived") => {
    if (!token) return;
    await fetch(`/api/projects/${projectId}/context/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    await fetchEntries(pagination.page);
  };

  const handleGenerateQuestions = async () => {
    if (!token) return;
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/context/generate-questions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGenerateMsg(`Added ${data.created} question${data.created === 1 ? "" : "s"}.`);
        await fetchEntries(1);
      } else {
        const data = await res.json().catch(() => ({}));
        setGenerateMsg(data.error || "Failed to generate questions.");
      }
    } catch (e) {
      setGenerateMsg((e as Error).message);
    } finally {
      setGenerating(false);
      setTimeout(() => setGenerateMsg(null), 5000);
    }
  };

  const lastUpdated = entries.length > 0 ? entries[0].updatedAt : null;

  return (
    <div className="px-3 md:px-8 pb-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            {lastUpdated && (
              <span className="text-xs" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>
                Last updated {timeAgo(lastUpdated)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchEntries(pagination.page)}
              className="p-2 rounded-md hover:bg-[#f7f6f3]"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" style={{ color: "#555a6a" }} />
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 rounded-md hover:bg-[#f7f6f3]"
              title="Help"
            >
              <HelpCircle className="w-3.5 h-3.5" style={{ color: "#555a6a" }} />
            </button>
            {isAdmin && (
              <button
                onClick={handleGenerateQuestions}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#5b76fe 0%, #6b3eb8 100%)",
                  color: "#ffffff",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {generating ? "Thinking..." : "Generate scope questions"}
              </button>
            )}
          </div>
        </div>

        {generateMsg && (
          <div
            className="mb-3 p-2 rounded-md text-xs"
            style={{ background: "#eef0ff", color: "#3a4abf", fontFamily: "DM Sans, sans-serif" }}
          >
            {generateMsg}
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div className="overflow-x-auto pb-2 -mx-3 px-3 md:px-0">
            <div
              className="flex items-center gap-1 p-1 rounded-xl"
              style={{ background: "#f7f6f3", width: "fit-content", minWidth: "max-content" }}
            >
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all whitespace-nowrap"
                  style={{
                    background: filter === f.key ? "#ffffff" : "transparent",
                    color: filter === f.key ? "#1c1c1e" : "#555a6a",
                    fontFamily: "DM Sans, sans-serif",
                    boxShadow: filter === f.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto pb-2 -mx-3 px-3 md:px-0">
            <div
              className="flex items-center gap-1 p-1 rounded-xl"
              style={{ background: "#f7f6f3", width: "fit-content", minWidth: "max-content" }}
            >
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all whitespace-nowrap"
                  style={{
                    background: statusFilter === s.key ? "#ffffff" : "transparent",
                    color: statusFilter === s.key ? "#1c1c1e" : "#555a6a",
                    fontFamily: "DM Sans, sans-serif",
                    boxShadow: statusFilter === s.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filter === "treemap_view" ? (
          <TreemapViewer projectId={projectId} token={token} isAdmin={isAdmin} />
        ) : (
          <div className="space-y-3">
            <EntryComposer
              key={`composer-${filter}`}
              projectId={projectId}
              token={token}
              isAdmin={isAdmin}
              defaultKind={
                filter === "all" ? "note" : (filter as ContextKind)
              }
              onCreated={() => fetchEntries(pagination.page)}
            />

            {loading ? (
              <div
                className="text-xs p-6 text-center rounded-xl"
                style={{ background: "#fafafa", color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}
              >
                Loading...
              </div>
            ) : entries.length === 0 ? (
              <div
                className="text-xs p-6 text-center rounded-xl"
                style={{ background: "#fafafa", color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}
              >
                No entries yet. Add a question, note, or paste context above.
              </div>
            ) : (
              entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  canEdit={isAdmin || entry.createdBy === user?.id}
                  canDelete={isAdmin || entry.createdBy === user?.id}
                  isAdmin={isAdmin}
                  onEdit={handleEditEntry}
                  onDelete={handleDeleteEntry}
                  onTogglePin={isAdmin ? handleTogglePin : undefined}
                  onStatusChange={isAdmin ? handleStatusChange : undefined}
                />
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4 px-1">
            <span className="text-[13px]" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchEntries(pagination.page - 1)}
                disabled={!pagination.hasPrev}
                className="p-2 rounded-lg border hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-all"
                style={{ borderColor: "#c7cad5" }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[13px] tabular-nums" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchEntries(pagination.page + 1)}
                disabled={!pagination.hasNext}
                className="p-2 rounded-lg border hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-all"
                style={{ borderColor: "#c7cad5" }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Help Modal */}
        {showHelp && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(0,0,0,0.50)" }}
            onClick={() => setShowHelp(false)}
          >
            <div
              className="max-w-2xl w-full mx-4 p-6 rounded-xl max-h-[80vh] overflow-y-auto"
              style={{ background: "#ffffff", border: "1px solid #e9e9e9" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                  Context Workspace Help
                </h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-1 rounded-md hover:bg-[#f7f6f3]"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 text-sm" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
                <section>
                  <h3 className="font-semibold mb-2" style={{ color: "#1c1c1e" }}>Entry Types</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Questions:</strong> User queries or requirements</li>
                    <li><strong>Tasks:</strong> Actionable items or todos</li>
                    <li><strong>Notes:</strong> General information or observations</li>
                    <li><strong>Ingest:</strong> Imported content from external sources</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold mb-2" style={{ color: "#1c1c1e" }}>Status Management</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Active:</strong> Default state for new entries</li>
                    <li><strong>Completed:</strong> Entries that have been addressed or resolved</li>
                    <li><strong>Archived:</strong> Entries no longer relevant but kept for reference</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold mb-2" style={{ color: "#1c1c1e" }}>Actions</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Edit:</strong> Modify title and body (authors and admins)</li>
                    <li><strong>Delete:</strong> Remove entries (authors and admins)</li>
                    <li><strong>Pin:</strong> Highlight important entries (admins only)</li>
                    <li><strong>Status Changes:</strong> Move between active/completed/archived (admins only)</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold mb-2" style={{ color: "#1c1c1e" }}>Filtering & Navigation</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Use kind filters to show specific types of entries</li>
                    <li>Use status filters to view entries by lifecycle state</li>
                    <li>Navigate through pages using Previous/Next buttons</li>
                    <li>20 entries displayed per page for optimal performance</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold mb-2" style={{ color: "#1c1c1e" }}>Creating Entries</h3>
                  <p>Use the composer at the bottom to add new entries. Select the appropriate type and add your content. AI assistance is available for content refinement and suggestions.</p>
                  <p className="mt-2"><strong>For Ingest entries:</strong> Paste repository analysis, documentation, or reference text. Example command output:</p>
                  <code className="block mt-1 p-2 text-xs rounded bg-gray-100" style={{ background: "#f7f6f3", fontFamily: "monospace" }}>
                    tree -L 5 -I 'node_modules|.git|.next|dist|build|.cache' -a
                  </code>
                </section>

                <section>
                  <h3 className="font-semibold mb-2" style={{ color: "#1c1c1e" }}>AI Features</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Generate Questions:</strong> Auto-create scope questions from existing context (admins only)</li>
                    <li><strong>Refine Content:</strong> AI-powered content improvement during creation</li>
                    <li><strong>Suggest Content:</strong> AI-generated suggestions when fields are empty</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold mb-2" style={{ color: "#1c1c1e" }}>Tips</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Pinned entries appear at the top and have special highlighting</li>
                    <li>Status changes help organize your workspace by completion state</li>
                    <li>Use filters to focus on specific types or statuses</li>
                    <li>Entries are ordered by pin status, then by most recent updates</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
