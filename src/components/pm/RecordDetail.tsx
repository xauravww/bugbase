"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Save, Plus, ExternalLink, Sparkles } from "lucide-react";
import { Button, PageLoader, Select, Badge, useToast, ConfirmDialog } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getMeta, titleField, MODULE_META } from "@/lib/modules/meta";
import { usePmOptions, FieldInput, relLabel, type Rec } from "./shared";
import { enumColor } from "@/lib/modules/colors";

/**
 * Full-page create / edit view for a PM record. Replaces the modal:
 * a back button, the editable field set (long fields use MarkdownEditor with
 * image support), plus a sidebar to jump to linked records and spawn related
 * records one-click (child module prefilled with this record's FK + project).
 */
export function RecordDetail({ slug, id }: { slug: string; id: string }) {
  const meta = getMeta(slug);
  const isNew = id === "new";
  const { token, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { projects, users, relations, authHeaders } = usePmOptions(meta);

  const [form, setForm] = useState<Rec>({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [refiningField, setRefiningField] = useState<string | null>(null);
  const [backHref, setBackHref] = useState(`/pm/${slug}`);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const canWrite = user?.role !== "Viewer";

  // Preserve the origin ("from" query) so the back button returns to the
  // project workspace + module chip we came from, not the standalone list.
  // Also preserve any list filter params for standalone mode.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const from = sp.get("from");
    if (from) setBackHref(from);
    else {
      sp.delete("view");
      const rest = sp.toString();
      if (rest) setBackHref(`/pm/${slug}?${rest}`);
    }
  }, [slug]);

  const backLabel = backHref.includes("tab=workspace") ? "Back" : meta?.label;
  const withFrom = (url: string) => {
    const from = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
    return from ? `${url}${url.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}` : url;
  };

  // modules that link back to this one (for one-click related create)
  const childModules = useMemo(() => {
    if (!meta) return [];
    return Object.values(MODULE_META).filter((m) =>
      m.fields.some((f) => f.relation === slug)
    ).map((m) => ({ slug: m.slug, label: m.singular, fkKey: m.fields.find((f) => f.relation === slug)!.key }));
  }, [meta, slug]);

  const load = useCallback(async () => {
    if (!token || !meta || isNew) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pm/${slug}/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const rec: Rec = {};
      meta.fields.forEach((f) => {
        let v = data.record[f.key];
        if (f.type === "date" && v) v = new Date(v as string).toISOString().slice(0, 10);
        rec[f.key] = v ?? "";
      });
      rec.projectId = data.record.projectId;
      rec.id = data.record.id;
      rec.createdAt = data.record.createdAt;
      setForm(rec);
    } catch (e) {
      toast.error((e as Error).message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token, meta, slug, id, isNew, authHeaders, toast]);

  useEffect(() => { load(); }, [load]);

  // prefill for `new`: project + any FK / defaults from URL query
  useEffect(() => {
    if (!isNew || !meta) return;
    const params = new URLSearchParams(window.location.search);
    const init: Rec = {};
    for (const f of meta.fields) if (f.default !== undefined) init[f.key] = f.default;
    const pid = params.get("projectId");
    if (pid) init.projectId = Number(pid);
    for (const f of meta.fields) {
      if (f.relation) {
        const val = params.get(f.key);
        if (val) init[f.key] = Number(val);
      }
    }
    setForm(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, slug]);

  const setField = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const refineField = async (fieldKey: string) => {
    const content = String(form[fieldKey] ?? "").trim();
    if (!content) {
      toast.error(`Add ${meta?.fields.find((field) => field.key === fieldKey)?.label.toLowerCase() || "content"} before refining it`);
      return;
    }
    setRefiningField(fieldKey);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content, field: fieldKey, context: { module: meta?.label, project: form.projectId } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.refinedContent) throw new Error(data.error || "AI refinement failed");
      setField(fieldKey, data.refinedContent);
      toast.success("AI refinement ready to review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI refinement failed");
    } finally {
      setRefiningField(null);
    }
  };

  const save = async () => {
    if (!meta) return;
    const tKey = titleField(meta);
    if (!form[tKey] || String(form[tKey]).trim().length < 2) {
      toast.error(`${meta.fields.find((x) => x.key === tKey)?.label} is required`);
      return;
    }
    if (!form.projectId) { toast.error("Select a project"); return; }
    setSaving(true);
    try {
      const url = isNew ? `/api/pm/${slug}` : `/api/pm/${slug}/${id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ ...form, projectId: Number(form.projectId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success(isNew ? "Created" : "Saved");
      if (isNew) router.replace(withFrom(`/pm/${slug}/${data.record.id}`));
      else load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      const res = await fetch(`/api/pm/${slug}/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error();
      toast.success("Deleted");
      router.push(backHref);
    } catch {
      toast.error("Delete failed");
    }
  };

  if (!meta) return <div className="p-6">Unknown module.</div>;
  if (loading) return <PageLoader />;

  const tKey = titleField(meta);
  const projKey = projects.find((p) => p.id === Number(form.projectId))?.key;
  const statusVal = meta.statusKey ? String(form[meta.statusKey] ?? "") : "";
  const sc = statusVal ? enumColor(statusVal) : null;

  return (
    <div className="min-h-full">
      {/* top bar */}
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border px-4 md:px-6 h-14 flex items-center gap-3">
        <button onClick={() => router.push(backHref)} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </button>
        <span className="text-fg-subtle">/</span>
        <span className="text-sm font-medium text-fg truncate">
          {isNew ? `New ${meta.singular}` : String(form[tKey] || `#${id}`)}
        </span>
        {sc && <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: sc.color, background: sc.bg }}>{statusVal}</span>}
        <div className="ml-auto flex items-center gap-2">
          {!isNew && canWrite && <Button variant="ghost" size="sm" leftIcon={Trash2} onClick={remove}>Delete</Button>}
          {canWrite && <Button variant="primary" size="sm" leftIcon={Save} onClick={save} loading={saving}>{isNew ? "Create" : "Save"}</Button>}
        </div>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 max-w-6xl mx-auto">
        {/* main form */}
        <div className="space-y-4 order-2 lg:order-1">
          <Select
            label="Project"
            value={form.projectId ? String(form.projectId) : ""}
            onChange={(e) => setField("projectId", e.target.value)}
            options={projects.map((p) => ({ value: String(p.id), label: `${p.key} · ${p.name}` }))}
            placeholder="Select project"
            searchable
          />
          {meta.fields.map((f) => {
            const aiEligible = ["text", "textarea", "richtext", "tags"].includes(f.type);
            return (
              <div key={f.key} className="space-y-1.5">
                <FieldInput
                  field={f}
                  value={form[f.key]}
                  onChange={(v) => setField(f.key, v)}
                  users={users}
                  relations={relations}
                />
                {aiEligible && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      leftIcon={Sparkles}
                      loading={refiningField === f.key}
                      disabled={!form[f.key] || refiningField !== null}
                      onClick={() => refineField(f.key)}
                    >
                      Refine with AI
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* sidebar: linked + related create */}
        <aside className="space-y-5 order-1 lg:order-2">
          {projKey && (
            <div>
              <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-2">Project</h3>
              <Link href={`/projects/${form.projectId}?tab=workspace`} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
                <Badge variant="neutral" size="sm">{projKey}</Badge>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* linked FK fields → jump */}
          {meta.fields.filter((f) => f.relation && f.relation !== "users" && form[f.key]).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-2">Links</h3>
              <div className="space-y-1.5">
                {meta.fields.filter((f) => f.relation && f.relation !== "users" && form[f.key]).map((f) => (
                  <Link key={f.key} href={`/pm/${f.relation}/${form[f.key]}`} className="flex items-center justify-between text-sm text-fg hover:text-accent group">
                    <span className="text-fg-muted">{f.label}</span>
                    <span className="inline-flex items-center gap-1 truncate max-w-[160px]">{relLabel(f, form[f.key], users, relations)} <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" /></span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* one-click related create */}
          {!isNew && canWrite && childModules.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-2">Create related</h3>
              <div className="flex flex-col gap-1.5">
                {childModules.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/pm/${c.slug}/new?projectId=${form.projectId}&${c.fkKey}=${id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg hover:bg-bg-hover rounded px-2 py-1.5 -mx-2 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> New {c.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title={`Delete ${meta?.singular ?? "Record"}`}
        message={`Delete this ${meta?.singular.toLowerCase()}?`}
      />
    </div>
  );
}
