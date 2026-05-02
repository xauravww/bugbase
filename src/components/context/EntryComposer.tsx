"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Save, X, AlertTriangle, Sparkles, Pin, ImagePlus, Link as LinkIcon, Trash2 } from "lucide-react";
import type { ContextKind, SimilarHit, ContextAttachment } from "./types";

interface Props {
  projectId: number;
  token: string | null;
  isAdmin: boolean;
  defaultKind?: ContextKind;
  hideKindPicker?: boolean;
  onCreated: () => void;
}

const KIND_OPTIONS: { value: ContextKind; label: string }[] = [
  { value: "feature", label: "Feature" },
  { value: "question", label: "Question" },
  { value: "answer", label: "Answer" },
  { value: "note", label: "Note" },
  { value: "task", label: "Task" },
  { value: "ingest", label: "Ingest" },
  { value: "custom", label: "Custom" },
];

const ACCENT = { bg: "#c3faf5", fg: "#187574" };

export function EntryComposer({ projectId, token, isAdmin, defaultKind = "note", hideKindPicker, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ContextKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [attachments, setAttachments] = useState<ContextAttachment[]>([]);
  const [references, setReferences] = useState<{ url: string; label?: string }[]>([]);
  const [refUrl, setRefUrl] = useState("");
  const [refLabel, setRefLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [similar, setSimilar] = useState<SimilarHit[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideSave, setOverrideSave] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!token) return;
    setUploading(true);
    setError(null);
    try {
      const arr = Array.from(files);
      const uploaded: ContextAttachment[] = [];
      for (const f of arr) {
        const fd = new FormData();
        fd.append("image", f);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed");
        }
        const data = await res.json();
        uploaded.push({ url: data.url, thumbnail: data.thumbnail || data.url, type: "image", caption: f.name });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const addReference = () => {
    if (!refUrl.trim()) return;
    setReferences((prev) => [...prev, { url: refUrl.trim(), label: refLabel.trim() || undefined }]);
    setRefUrl("");
    setRefLabel("");
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!body || body.length < 12 || !token) {
      setSimilar([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setCheckingSimilar(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/context/similar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: `${title}\n${body}`.trim(), k: 4 }),
        });
        if (res.ok) {
          const data = await res.json();
          setSimilar(data.similar || []);
        }
      } catch {}
      setCheckingSimilar(false);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [body, title, projectId, token]);

  const reset = () => {
    setTitle("");
    setBody("");
    setSimilar([]);
    setPinned(false);
    setAttachments([]);
    setReferences([]);
    setRefUrl("");
    setRefLabel("");
    setOverrideSave(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!body.trim() || !token) return;
    if (similar.length > 0 && !overrideSave) {
      setOverrideSave(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const meta: Record<string, unknown> = {};
      if (attachments.length) meta.attachments = attachments;
      if (references.length) meta.references = references;
      const res = await fetch(`/api/projects/${projectId}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind,
          title: title.trim() || undefined,
          body,
          pinned: isAdmin ? pinned : false,
          source: isAdmin && pinned ? "admin_pin" : "user",
          metadata: Object.keys(meta).length ? JSON.stringify(meta) : undefined,
          skipSimilarity: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save");
      } else {
        reset();
        setOpen(false);
        onCreated();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-xl transition-all hover:opacity-90"
        style={{
          background: "#ffffff",
          border: "1px dashed #c3c5cf",
          color: "#555a6a",
          fontFamily: "DM Sans, sans-serif",
        }}
      >
        <Plus className="w-4 h-4" /> Add a question, note, task, or paste context
      </button>
    );
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "#ffffff",
        border: "1px solid #e9e9e9",
        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {!hideKindPicker && (
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ContextKind)}
              className="text-xs font-medium px-2 py-1 rounded-md outline-none"
              style={{
                background: "#f7f6f3",
                border: "1px solid #e9e9e9",
                color: "#1c1c1e",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button
              onClick={() => setPinned((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md"
              style={{
                background: pinned ? ACCENT.bg : "#f7f6f3",
                color: pinned ? ACCENT.fg : "#555a6a",
                border: "1px solid " + (pinned ? ACCENT.bg : "#e9e9e9"),
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              <Pin className="w-3 h-3" /> {pinned ? "Pinned" : "Pin"}
            </button>
          )}
        </div>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="p-1.5 rounded-md hover:bg-[#f7f6f3]"
        >
          <X className="w-4 h-4" style={{ color: "#555a6a" }} />
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full px-3 py-2 text-sm rounded-md outline-none focus:ring-2 mb-2"
        style={{ background: "#fafafa", border: "1px solid #e9e9e9", fontFamily: "DM Sans, sans-serif" }}
      />
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setOverrideSave(false);
        }}
        rows={Math.min(14, Math.max(4, body.split("\n").length))}
        placeholder={
          kind === "feature"
            ? "Describe the feature: scope, behavior, acceptance criteria. Attach screenshots/mocks below."
            : kind === "question"
            ? "What scope question are you asking?"
            : kind === "ingest"
            ? "Paste gitingest output, repo summary, or any reference text..."
            : kind === "task"
            ? "What needs testing or doing?"
            : "Type your note, finding, or context..."
        }
        className="w-full px-3 py-2 text-sm rounded-md outline-none focus:ring-2 resize-y"
        style={{ background: "#fafafa", border: "1px solid #e9e9e9", fontFamily: "DM Sans, sans-serif" }}
      />

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md disabled:opacity-50"
            style={{ background: "#f7f6f3", color: "#1c1c1e", border: "1px solid #e9e9e9", fontFamily: "DM Sans, sans-serif" }}
          >
            <ImagePlus className="w-3.5 h-3.5" /> {uploading ? "Uploading..." : "Add screenshots"}
          </button>
          <span className="text-[11px]" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>
            PNG/JPG/GIF/WebP/SVG · multiple OK
          </span>
        </div>

        {attachments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {attachments.map((a, i) => (
              <div
                key={a.url + i}
                className="relative group rounded-md overflow-hidden"
                style={{ border: "1px solid #e9e9e9", background: "#fafafa" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.thumbnail || a.url} alt={a.caption || "attachment"} className="w-full h-24 object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(255,255,255,0.95)", color: "#a3324a" }}
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <LinkIcon className="w-3.5 h-3.5" style={{ color: "#555a6a" }} />
          <input
            value={refUrl}
            onChange={(e) => setRefUrl(e.target.value)}
            placeholder="Reference URL (optional)"
            className="flex-1 min-w-[180px] px-2 py-1 text-xs rounded-md outline-none"
            style={{ background: "#fafafa", border: "1px solid #e9e9e9", fontFamily: "DM Sans, sans-serif" }}
          />
          <input
            value={refLabel}
            onChange={(e) => setRefLabel(e.target.value)}
            placeholder="Label"
            className="w-32 px-2 py-1 text-xs rounded-md outline-none"
            style={{ background: "#fafafa", border: "1px solid #e9e9e9", fontFamily: "DM Sans, sans-serif" }}
          />
          <button
            type="button"
            onClick={addReference}
            disabled={!refUrl.trim()}
            className="px-2 py-1 text-xs font-medium rounded-md disabled:opacity-50"
            style={{ background: "#f7f6f3", color: "#1c1c1e", border: "1px solid #e9e9e9", fontFamily: "DM Sans, sans-serif" }}
          >
            Add
          </button>
        </div>

        {references.length > 0 && (
          <ul className="space-y-1">
            {references.map((r, i) => (
              <li
                key={r.url + i}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded-md text-xs"
                style={{ background: "#fafafa", border: "1px solid #e9e9e9", fontFamily: "DM Sans, sans-serif" }}
              >
                <a href={r.url} target="_blank" rel="noreferrer" className="truncate" style={{ color: "#187574" }}>
                  {r.label || r.url}
                </a>
                <button
                  type="button"
                  onClick={() => setReferences((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-1 rounded-md hover:bg-[#fde8ec]"
                >
                  <Trash2 className="w-3 h-3" style={{ color: "#a3324a" }} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(checkingSimilar || similar.length > 0) && (
        <div
          className="mt-3 p-3 rounded-md"
          style={{
            background: similar.length > 0 ? "#fff7e0" : "#f7f6f3",
            border: "1px solid " + (similar.length > 0 ? "#f0d894" : "#e9e9e9"),
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {similar.length > 0 ? (
              <AlertTriangle className="w-4 h-4" style={{ color: "#8a6300" }} />
            ) : (
              <Sparkles className="w-4 h-4" style={{ color: "#555a6a" }} />
            )}
            <span
              className="text-xs font-medium"
              style={{
                color: similar.length > 0 ? "#8a6300" : "#555a6a",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              {checkingSimilar
                ? "Checking for duplicates..."
                : similar.length > 0
                ? `${similar.length} similar entr${similar.length === 1 ? "y" : "ies"} found`
                : ""}
            </span>
          </div>
          {similar.map((h) => (
            <div
              key={h.entryId}
              className="text-xs py-1.5 border-t"
              style={{ borderColor: "#f0d894", color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}
            >
              <span style={{ color: "#8a6300", fontWeight: 600 }}>{Math.round(h.similarity * 100)}%</span>{" "}
              <span style={{ color: "#555a6a" }}>[{h.kind}]</span>{" "}
              {h.title ? <strong>{h.title}: </strong> : null}
              {h.body.slice(0, 140)}
              {h.body.length > 140 ? "…" : ""}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs" style={{ color: "#a3324a", fontFamily: "DM Sans, sans-serif" }}>
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 justify-end mt-3">
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium rounded-md"
          style={{ background: "#f7f6f3", color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !body.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-50"
          style={{ background: ACCENT.bg, color: ACCENT.fg, fontFamily: "DM Sans, sans-serif" }}
        >
          <Save className="w-3.5 h-3.5" />
          {saving
            ? "Saving..."
            : similar.length > 0 && !overrideSave
            ? "Save anyway"
            : "Save"}
        </button>
      </div>
    </div>
  );
}
