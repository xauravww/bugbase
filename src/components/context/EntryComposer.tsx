"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Save, X, AlertTriangle, Sparkles, Pin } from "lucide-react";
import type { ContextKind, SimilarHit } from "./types";

interface Props {
  projectId: number;
  token: string | null;
  isAdmin: boolean;
  defaultKind?: ContextKind;
  hideKindPicker?: boolean;
  onCreated: () => void;
}

const KIND_OPTIONS: { value: ContextKind; label: string }[] = [
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
  const [similar, setSimilar] = useState<SimilarHit[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideSave, setOverrideSave] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const res = await fetch(`/api/projects/${projectId}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind,
          title: title.trim() || undefined,
          body,
          pinned: isAdmin ? pinned : false,
          source: isAdmin && pinned ? "admin_pin" : "user",
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
          kind === "question"
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
