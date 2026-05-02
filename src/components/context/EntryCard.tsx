"use client";

import { useState } from "react";
import { Pencil, Trash2, Sparkles, Pin, Save, X, CheckCircle, Archive, Link as LinkIcon } from "lucide-react";
import type { ContextEntry, ContextAttachment, ContextEntryMetadata } from "./types";

interface Props {
  entry: ContextEntry;
  canEdit: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  onEdit: (entryId: number, body: string, title: string | null) => Promise<void>;
  onDelete: (entryId: number) => Promise<void>;
  onTogglePin?: (entryId: number, pinned: boolean) => Promise<void>;
  onStatusChange?: (entryId: number, status: "active" | "completed" | "archived") => Promise<void>;
}

const KIND_LABEL: Record<string, string> = {
  feature: "Feature",
  question: "Question",
  answer: "Answer",
  note: "Note",
  task: "Task",
  ingest: "Ingest",
  ingest_chunk: "Ingest chunk",
  treemap: "Treemap",
  custom: "Custom",
};

const KIND_COLOR: Record<string, { bg: string; fg: string }> = {
  feature: { bg: "#dff5e8", fg: "#1a6b3a" },
  question: { bg: "#fff7e0", fg: "#8a6300" },
  answer: { bg: "#e8f7ec", fg: "#1f7a3a" },
  note: { bg: "#eef0ff", fg: "#3a4abf" },
  task: { bg: "#c3faf5", fg: "#187574" },
  ingest: { bg: "#f5f0ff", fg: "#6b3eb8" },
  ingest_chunk: { bg: "#f5f0ff", fg: "#6b3eb8" },
  treemap: { bg: "#fde8ec", fg: "#a3324a" },
  custom: { bg: "#f0f0f0", fg: "#555a6a" },
};

function parseMeta(raw: string | null): ContextEntryMetadata {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ContextEntryMetadata;
  } catch {
    return {};
  }
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function EntryCard({ entry, canEdit, canDelete, isAdmin, onEdit, onDelete, onTogglePin, onStatusChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(entry.body);
  const [draftTitle, setDraftTitle] = useState(entry.title || "");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const kindStyle = KIND_COLOR[entry.kind] || KIND_COLOR.custom;
  const meta = parseMeta(entry.metadata);
  const atts: ContextAttachment[] = Array.isArray(meta.attachments) ? meta.attachments : [];
  const refs = Array.isArray(meta.references) ? meta.references : [];

  const handleSave = async () => {
    if (!draftBody.trim()) return;
    setSaving(true);
    try {
      await onEdit(entry.id, draftBody, draftTitle.trim() || null);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraftBody(entry.body);
    setDraftTitle(entry.title || "");
    setEditing(false);
  };

  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: "#ffffff",
        border: entry.pinned ? "1px solid #c3faf5" : "1px solid #e9e9e9",
        boxShadow: entry.pinned ? "0 2px 8px rgba(24,117,116,0.08)" : "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-md"
            style={{ background: kindStyle.bg, color: kindStyle.fg, fontFamily: "DM Sans, sans-serif" }}
          >
            {KIND_LABEL[entry.kind] || entry.kind}
          </span>
          {entry.source === "ai" && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ background: "#f5f0ff", color: "#6b3eb8", fontFamily: "DM Sans, sans-serif" }}
            >
              <Sparkles className="w-3 h-3" /> AI
            </span>
          )}
          {entry.pinned && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ background: "#c3faf5", color: "#187574", fontFamily: "DM Sans, sans-serif" }}
            >
              <Pin className="w-3 h-3" /> Pinned
            </span>
          )}
          {entry.status === "completed" && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ background: "#e8f7ec", color: "#1f7a3a", fontFamily: "DM Sans, sans-serif" }}
            >
              <CheckCircle className="w-3 h-3" /> Completed
            </span>
          )}
          {entry.status === "archived" && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ background: "#f5f5f5", color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}
            >
              <Archive className="w-3 h-3" /> Archived
            </span>
          )}
          <span className="text-[12px]" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>
            {entry.creator?.name || "Unknown"} · {timeAgo(entry.updatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editing && canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-md hover:bg-[#f7f6f3] transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" style={{ color: "#555a6a" }} />
            </button>
          )}
          {!editing && isAdmin && onTogglePin && (
            <button
              onClick={() => onTogglePin(entry.id, !entry.pinned)}
              className="p-1.5 rounded-md hover:bg-[#f7f6f3] transition-colors"
              title={entry.pinned ? "Unpin" : "Pin"}
            >
              <Pin className="w-3.5 h-3.5" style={{ color: entry.pinned ? "#187574" : "#555a6a" }} />
            </button>
          )}
          {!editing && onStatusChange && entry.status === "active" && (
            <button
              onClick={() => onStatusChange(entry.id, "completed")}
              className="p-1.5 rounded-md hover:bg-[#e8f7ec] transition-colors"
              title="Mark as Completed"
            >
              <CheckCircle className="w-3.5 h-3.5" style={{ color: "#1f7a3a" }} />
            </button>
          )}
          {!editing && onStatusChange && entry.status === "active" && (
            <button
              onClick={() => onStatusChange(entry.id, "archived")}
              className="p-1.5 rounded-md hover:bg-[#f5f5f5] transition-colors"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5" style={{ color: "#555a6a" }} />
            </button>
          )}
          {!editing && onStatusChange && entry.status !== "active" && (
            <button
              onClick={() => onStatusChange(entry.id, "active")}
              className="p-1.5 rounded-md hover:bg-[#c3faf5] transition-colors"
              title="Restore to Active"
            >
              <CheckCircle className="w-3.5 h-3.5" style={{ color: "#187574" }} />
            </button>
          )}
          {!editing && canDelete && (
            <button
              onClick={() => setConfirmDel(true)}
              className="p-1.5 rounded-md hover:bg-[#fde8ec] transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" style={{ color: "#a3324a" }} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full px-3 py-2 text-sm rounded-md outline-none focus:ring-2"
            style={{
              background: "#fafafa",
              border: "1px solid #e9e9e9",
              fontFamily: "DM Sans, sans-serif",
            }}
          />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={Math.min(20, Math.max(3, draftBody.split("\n").length))}
            className="w-full px-3 py-2 text-sm rounded-md outline-none focus:ring-2 resize-y"
            style={{
              background: "#fafafa",
              border: "1px solid #e9e9e9",
              fontFamily: "DM Sans, sans-serif",
            }}
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md"
              style={{ background: "#f7f6f3", color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !draftBody.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-50"
              style={{ background: "#c3faf5", color: "#187574", fontFamily: "DM Sans, sans-serif" }}
            >
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {entry.title && (
            <div
              className="text-sm font-semibold mb-1"
              style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}
            >
              {entry.title}
            </div>
          )}
          <div
            className="text-sm whitespace-pre-wrap break-words"
            style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif", lineHeight: 1.55 }}
          >
            {entry.body.length > 800 ? entry.body.slice(0, 800) + "…" : entry.body}
          </div>
          {atts.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {atts.map((a, i) => (
                <a
                  key={a.url + i}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md overflow-hidden hover:opacity-90 transition-opacity"
                  style={{ border: "1px solid #e9e9e9", background: "#fafafa" }}
                  title={a.caption || "Open full image"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.thumbnail || a.url} alt={a.caption || "screenshot"} className="w-full h-28 object-cover" />
                </a>
              ))}
            </div>
          )}
          {refs.length > 0 && (
            <ul className="mt-3 space-y-1">
              {refs.map((r, i) => (
                <li key={r.url + i} className="flex items-center gap-1.5 text-xs">
                  <LinkIcon className="w-3 h-3 shrink-0" style={{ color: "#187574" }} />
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate hover:underline"
                    style={{ color: "#187574", fontFamily: "DM Sans, sans-serif" }}
                  >
                    {r.label || r.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {confirmDel && (
        <div className="mt-3 p-3 rounded-md flex items-center justify-between gap-3" style={{ background: "#fde8ec" }}>
          <span className="text-xs" style={{ color: "#a3324a", fontFamily: "DM Sans, sans-serif" }}>
            Delete this entry? This cannot be undone.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmDel(false)}
              className="px-3 py-1 text-xs rounded-md"
              style={{ background: "#ffffff", color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await onDelete(entry.id);
                setConfirmDel(false);
              }}
              className="px-3 py-1 text-xs font-medium rounded-md"
              style={{ background: "#a3324a", color: "#ffffff", fontFamily: "DM Sans, sans-serif" }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
