"use client";

import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bold, Italic, Heading2, List, ListOrdered, Code, Link2, Image as ImageIcon,
  Eye, Pencil, Quote, CheckSquare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui";
import { FieldHelpButton } from "@/components/ui/FieldHelp";
import { cn } from "@/lib/utils/cn";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  minRows?: number;
  mono?: boolean;
  readOnly?: boolean;
}

/**
 * Markdown editor with a formatting toolbar, live preview toggle, and inline
 * image support (toolbar picker + drag-drop + clipboard paste). Images are
 * uploaded via /api/upload and inserted as standard markdown `![](url)` so
 * they render in preview and anywhere react-markdown is used. Suitable for
 * long-form fields (requirements, release notes, docs).
 */
export function MarkdownEditor({ value, onChange, label, placeholder, minRows = 10, mono, readOnly = false }: Props) {
  const { token } = useAuth();
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">(readOnly ? "preview" : "write");
  const [uploading, setUploading] = useState(false);

  const surround = useCallback((before: string, after = before, placeholderText = "text") => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = value.slice(start, end) || placeholderText;
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + sel.length;
    });
  }, [value, onChange]);

  const prefixLine = useCallback((prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + prefix.length; });
  }, [value, onChange]);

  // onChange is a plain setter (v: string). Insert an upload marker, then
  // swap it for the final markdown once the image URL comes back.
  const doUpload = useCallback(async (file: File) => {
    if (!token) { toast.error("Not authenticated"); return; }
    setUploading(true);
    const marker = `![uploading…](#${Date.now()})`;
    const el = ref.current;
    const pos = el ? el.selectionStart : value.length;
    const withMarker = value.slice(0, pos) + marker + "\n" + value.slice(pos);
    onChange(withMarker);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      onChange(withMarker.replace(marker, `![${file.name}](${data.url})`));
    } catch (e) {
      toast.error((e as Error).message);
      onChange(withMarker.replace(marker + "\n", ""));
    } finally {
      setUploading(false);
    }
  }, [token, value, onChange, toast]);

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) { e.preventDefault(); doUpload(file); }
    }
  };
  const onDrop = (e: React.DragEvent) => {
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (file) { e.preventDefault(); doUpload(file); }
  };
  const onPickImage = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = () => { if (input.files?.[0]) doUpload(input.files[0]); };
    input.click();
  };

  const TOOLS = [
    { icon: Bold, title: "Bold", act: () => surround("**") },
    { icon: Italic, title: "Italic", act: () => surround("*") },
    { icon: Heading2, title: "Heading", act: () => prefixLine("## ") },
    { icon: Quote, title: "Quote", act: () => prefixLine("> ") },
    { icon: List, title: "Bullet list", act: () => prefixLine("- ") },
    { icon: ListOrdered, title: "Numbered list", act: () => prefixLine("1. ") },
    { icon: CheckSquare, title: "Task", act: () => prefixLine("- [ ] ") },
    { icon: Code, title: "Code", act: () => surround("`") },
    { icon: Link2, title: "Link", act: () => surround("[", "](url)", "text") },
    { icon: ImageIcon, title: "Image", act: onPickImage },
  ];

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-fg min-w-0">{label}</label>
          <FieldHelpButton
            label={label}
            kind="richtext"
            placeholder={placeholder}
          />
        </div>
      )}
      <div className={cn("rounded-lg overflow-hidden bg-surface", !readOnly && "border border-border")}>
        {/* toolbar */}
        {!readOnly && (
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-bg-hover flex-wrap">
          {TOOLS.map((t, i) => (
            <button
              key={i} type="button" title={t.title} onClick={t.act}
              className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-bg cursor-pointer transition-colors"
            >
              <t.icon className="w-4 h-4" />
            </button>
          ))}
          <div className="ml-auto flex items-center gap-0.5">
            {uploading && <span className="text-xs text-fg-muted mr-2">uploading…</span>}
            <button
              type="button" onClick={() => setMode("write")}
              className={cn("inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer", mode === "write" ? "bg-bg text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
            >
              <Pencil className="w-3.5 h-3.5" /> Write
            </button>
            <button
              type="button" onClick={() => setMode("preview")}
              className={cn("inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer", mode === "preview" ? "bg-bg text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>
        </div>
        )}

        {mode === "write" ? (
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            placeholder={placeholder ?? "Write markdown… paste or drop images"}
            rows={minRows}
            className={cn(
              "w-full px-3 py-2.5 bg-surface text-fg text-sm outline-none resize-y min-h-[160px]",
              mono && "font-mono"
            )}
          />
        ) : (
          <div className="px-4 py-3 prose prose-sm max-w-none min-h-[160px] text-fg">
            {value?.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-fg-subtle italic">Nothing to preview.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
