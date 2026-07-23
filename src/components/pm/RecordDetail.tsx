"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Save, Plus, ExternalLink, Sparkles, Pencil, X, CalendarClock } from "lucide-react";
import { Button, PageLoader, Select, Badge, useToast, ConfirmDialog } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getMeta, titleField, MODULE_META, type FieldDef } from "@/lib/modules/meta";
import { usePmOptions, FieldInput, relLabel, type Rec } from "./shared";
import { MarkdownEditor } from "./MarkdownEditor";
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
  const [editing, setEditing] = useState(isNew);
  const canWrite = user?.role !== "Viewer";

  // Preserve original navigation origin
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

  const backLabel = backHref.startsWith("/timeline")
    ? "Back to Timeline"
    : backHref.includes("tab=workspace")
      ? "Back to Workspace"
      : meta?.label ? `Back to ${meta.label}` : "Back";
  const withFrom = (url: string) => {
    const from = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
    return from ? `${url}${url.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}` : url;
  };

  const renderReadonlyValue = (f: FieldDef, val: unknown) => {
    if (val == null || val === "") return <span className="text-fg-subtle italic">Not specified</span>;

    if (f.type === "select") {
      const c = enumColor(val as string);
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase shadow-xs" style={{ color: c.color, background: c.bg }}>
          {String(val)}
        </span>
      );
    }
    if (f.type === "tags" && typeof val === "string" && val.trim()) {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {val.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
            <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/50">
              #{t}
            </span>
          ))}
        </div>
      );
    }
    if (f.type === "date") {
      return <span className="font-mono text-sm text-fg-muted">{new Date(val as string).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>;
    }
    if (f.relation && f.relation !== "users") {
      const label = relLabel(f, val, users, relations);
      return (
        <Link href={`/pm/${f.relation}/${val}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          {label}
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      );
    }
    if (f.type === "richtext" || f.type === "textarea") {
      return (
        <div className="prose dark:prose-invert max-w-none text-fg leading-relaxed font-sans bg-transparent border-0 p-0">
          <MarkdownEditor
            value={String(val)}
            onChange={() => {}}
            label=""
            minRows={1}
            readOnly={true}
          />
        </div>
      );
    }
    if (f.type === "number") return <span className="font-mono font-medium">{Number(val).toLocaleString()}</span>;
    return <span className="whitespace-pre-wrap text-fg">{String(val)}</span>;
  };

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
  }, [isNew, slug, meta]);

  const setField = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const refineField = async (fieldKey: string) => {
    const content = String(form[fieldKey] ?? "").trim();
    if (!content) {
      toast.error(`Add content before refining with AI`);
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
      toast.success("Refined with AI");
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
      toast.success(isNew ? "Created successfully" : "Saved changes");
      if (isNew) router.replace(withFrom(`/pm/${slug}/${data.record.id}`));
      else {
        load();
        setEditing(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      const res = await fetch(`/api/pm/${slug}/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error();
      toast.success("Deleted successfully");
      router.push(backHref);
    } catch {
      toast.error("Delete failed");
    }
  };

  if (!meta) return <div className="p-6">Unknown module.</div>;
  if (loading) return <PageLoader />;

  const tKey = titleField(meta);
  const titleVal = String(form[tKey] || (isNew ? `New ${meta.singular}` : `#${id}`));
  const projObj = projects.find((p) => p.id === Number(form.projectId));
  const projKey = projObj?.key;
  const statusVal = meta.statusKey ? String(form[meta.statusKey] ?? "") : "";
  const sc = statusVal ? enumColor(statusVal) : null;

  // Separate primary long-text field (e.g. content/description) from meta fields for editorial reading layout
  const primaryBodyField = meta.fields.find((f) => f.type === "richtext" || (f.type === "textarea" && f.key !== "summary")) || meta.fields.find((f) => f.type === "textarea");
  const headerAndMetaFields = meta.fields.filter((f) => f.key !== tKey && f.key !== primaryBodyField?.key);

  return (
    <div className="min-h-screen bg-bg pb-16">
      {/* Header bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/95 px-4 md:px-8 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(backHref)}
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> {backLabel}
          </button>
          <span className="text-fg-subtle font-light">/</span>
          <div className="flex items-center gap-2 truncate">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-bg-subtle text-fg-muted uppercase tracking-wider">
              {meta.singular}
            </span>
            <span className="truncate text-sm font-semibold text-fg">
              {titleVal}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={CalendarClock}
            onClick={() => router.push(form.projectId ? `/timeline?projectId=${form.projectId}` : "/timeline")}
          >
            Go to Timeline
          </Button>
          {!isNew && canWrite && !editing && (
            <Button variant="outline" size="sm" leftIcon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {!isNew && canWrite && (
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" leftIcon={Trash2} onClick={() => setShowDeleteConfirm(true)}>
              Delete
            </Button>
          )}
          {editing && canWrite && (
            <>
              {!isNew && (
                <Button variant="ghost" size="sm" leftIcon={X} onClick={() => { load(); setEditing(false); }}>
                  Cancel
                </Button>
              )}
              <Button variant="primary" size="sm" leftIcon={Save} onClick={save} loading={saving}>
                {isNew ? `Create ${meta.singular}` : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main container */}
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        {editing ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
            {/* Form Mode */}
            <div className="space-y-5 rounded-lg border border-border bg-surface p-5">
              <h2 className="text-base font-bold text-fg border-b border-border pb-3">
                {isNew ? `Create ${meta.singular}` : `Edit ${meta.singular}`}
              </h2>
              
              <Select
                label="Project"
                value={form.projectId ? String(form.projectId) : ""}
                onChange={(e) => setField("projectId", e.target.value)}
                options={projects.map((p) => ({ value: String(p.id), label: `${p.key} · ${p.name}` }))}
                placeholder="Select target project"
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
                          className="text-accent"
                        >
                          Refine with AI
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Editing Sidebar */}
            <aside className="space-y-6">
              <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
                <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider">Metadata Guidance</h3>
                <p className="text-xs text-fg-muted leading-relaxed">
                  Make sure to set standard classification tags, correct relationships, and detailed rich text markdown content for maximum team clarity.
                </p>
              </div>
            </aside>
          </div>
        ) : (
          /* Preview Mode - Domain-Tailored Layout Templates */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              {/* 1. API Docs */}
              {slug === "api-docs" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-accent/10 text-accent uppercase tracking-wider">
                      {String(form.httpMethod || "GET")}
                    </span>
                    <h1 className="text-xl font-mono font-bold text-fg">{String(form.endpoint || titleVal)}</h1>
                    {statusVal && (
                      <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium" style={{ color: sc?.color, background: sc?.bg }}>
                        {statusVal}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs border-b border-border pb-3">
                    <div><span className="text-fg-subtle font-semibold uppercase">Auth Mode:</span> <span className="font-medium text-fg">{String(form.authentication || "None")}</span></div>
                    <div><span className="text-fg-subtle font-semibold uppercase">Project:</span> <span className="font-medium text-fg">{projKey || "—"}</span></div>
                  </div>
                  {Boolean(form.requestBody) && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase">Request Schema / Body</h4>
                      <pre className="p-3 rounded-md bg-bg font-mono text-xs text-fg overflow-x-auto border border-border">{String(form.requestBody)}</pre>
                    </div>
                  )}
                  {Boolean(form.responseBody) && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase">Response Schema / Payload</h4>
                      <pre className="p-3 rounded-md bg-bg font-mono text-xs text-fg overflow-x-auto border border-border">{String(form.responseBody)}</pre>
                    </div>
                  )}
                </div>

              /* 2. Bugs */
              ) : slug === "bugs" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                    {statusVal && <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: sc?.color, background: sc?.bg }}>{statusVal}</span>}
                    {Boolean(form.severity) && <Badge variant="neutral" size="sm">Severity: {String(form.severity)}</Badge>}
                    {Boolean(form.environment) && <span className="text-xs text-fg-subtle font-mono uppercase">Env: {String(form.environment)}</span>}
                  </div>
                  <h1 className="text-xl font-bold text-fg">{titleVal}</h1>
                  {Boolean(form.description) && (
                    <div>
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase mb-1">Issue Description</h4>
                      <p className="text-sm text-fg leading-relaxed">{String(form.description)}</p>
                    </div>
                  )}
                  {Boolean(form.stepsToReproduce) && (
                    <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                      <h4 className="text-xs font-bold text-fg-subtle uppercase">Steps to Reproduce</h4>
                      <p className="text-xs font-mono text-fg whitespace-pre-wrap">{String(form.stepsToReproduce)}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Boolean(form.expectedResult) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Expected Result</span>
                        <p className="text-xs text-fg">{String(form.expectedResult)}</p>
                      </div>
                    )}
                    {Boolean(form.actualResult) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Actual Result</span>
                        <p className="text-xs text-fg">{String(form.actualResult)}</p>
                      </div>
                    )}
                  </div>
                </div>

              /* 3. User Journeys */
              ) : slug === "user-journeys" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h1 className="text-xl font-bold text-fg">{titleVal}</h1>
                      <div className="flex items-center gap-2 mt-1 text-xs text-fg-muted">
                        <span>Stage: <strong>{String(form.stage || "Awareness")}</strong></span>
                        {Boolean(form.persona) && <span>· Persona: <strong>{String(form.persona)}</strong></span>}
                      </div>
                    </div>
                    {statusVal && <span className="px-2.5 py-1 rounded text-xs font-semibold" style={{ color: sc?.color, background: sc?.bg }}>{statusVal}</span>}
                  </div>
                  {Boolean(form.description) && (
                    <div>
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase mb-1">Journey Overview</h4>
                      <p className="text-sm text-fg leading-relaxed">{String(form.description)}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {Boolean(form.touchpoints) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Touchpoints</span>
                        <p className="text-xs text-fg">{String(form.touchpoints)}</p>
                      </div>
                    )}
                    {Boolean(form.painPoints) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Pain Points</span>
                        <p className="text-xs text-fg">{String(form.painPoints)}</p>
                      </div>
                    )}
                    {Boolean(form.opportunities) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Opportunities</span>
                        <p className="text-xs text-fg">{String(form.opportunities)}</p>
                      </div>
                    )}
                  </div>
                </div>

              /* 4. Personas */
              ) : slug === "personas" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h1 className="text-xl font-bold text-fg">{titleVal}</h1>
                      {Boolean(form.role) && <span className="text-xs text-fg-muted">{String(form.role)}</span>}
                    </div>
                    {statusVal && <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: sc?.color, background: sc?.bg }}>{statusVal}</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Boolean(form.goals) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Goals</span>
                        <p className="text-xs text-fg leading-relaxed">{String(form.goals)}</p>
                      </div>
                    )}
                    {Boolean(form.painPoints) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Pain Points</span>
                        <p className="text-xs text-fg leading-relaxed">{String(form.painPoints)}</p>
                      </div>
                    )}
                    {Boolean(form.behaviors) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Behaviors</span>
                        <p className="text-xs text-fg leading-relaxed">{String(form.behaviors)}</p>
                      </div>
                    )}
                  </div>
                </div>

              /* 5. User Stories & Requirements */
              ) : slug === "user-stories" || slug === "requirements" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {statusVal && <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: sc?.color, background: sc?.bg }}>{statusVal}</span>}
                        {Boolean(form.priority) && <Badge variant="neutral" size="sm">Priority: {String(form.priority)}</Badge>}
                      </div>
                      <h1 className="text-xl font-bold text-fg">{titleVal}</h1>
                    </div>
                  </div>
                  {slug === "user-stories" && (Boolean(form.role) || Boolean(form.goal) || Boolean(form.benefit)) && (
                    <div className="p-3.5 rounded-md bg-bg border border-border text-xs leading-relaxed space-y-1">
                      <p><span className="font-bold uppercase text-fg-subtle">As a:</span> {String(form.role || "User")}</p>
                      <p><span className="font-bold uppercase text-fg-subtle">I want to:</span> {String(form.goal || "—")}</p>
                      <p><span className="font-bold uppercase text-fg-subtle">So that:</span> {String(form.benefit || "—")}</p>
                    </div>
                  )}
                  {Boolean(form.description) && (
                    <div>
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase mb-1">Description</h4>
                      <p className="text-sm text-fg leading-relaxed">{String(form.description)}</p>
                    </div>
                  )}
                  {Boolean(form.acceptanceCriteria) && (
                    <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                      <h4 className="text-xs font-bold text-fg-subtle uppercase">Acceptance Criteria</h4>
                      <p className="text-xs font-mono text-fg whitespace-pre-wrap">{String(form.acceptanceCriteria)}</p>
                    </div>
                  )}
                </div>

              /* 6. Releases & Sprints */
              ) : slug === "releases" || slug === "sprints" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h1 className="text-xl font-mono font-bold text-fg">{titleVal}</h1>
                      <div className="text-xs text-fg-muted mt-0.5">
                        {Boolean(form.releaseDate) && <span>Release Date: <strong>{new Date(form.releaseDate as string).toLocaleDateString()}</strong></span>}
                        {Boolean(form.startDate) && <span>Duration: <strong>{new Date(form.startDate as string).toLocaleDateString()} → {new Date(form.endDate as string).toLocaleDateString()}</strong></span>}
                      </div>
                    </div>
                    {statusVal && <span className="px-2.5 py-1 rounded text-xs font-semibold" style={{ color: sc?.color, background: sc?.bg }}>{statusVal}</span>}
                  </div>
                  {Boolean(form.goal) && (
                    <div>
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase mb-1">Sprint Goal</h4>
                      <p className="text-sm text-fg leading-relaxed">{String(form.goal)}</p>
                    </div>
                  )}
                  {Boolean(form.releaseNotes) && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase">Release Notes</h4>
                      {renderReadonlyValue(meta.fields.find(f => f.key === "releaseNotes")!, form.releaseNotes)}
                    </div>
                  )}
                </div>

              /* 7. Workflows & Business Rules */
              ) : slug === "workflows" || slug === "business-rules" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h1 className="text-xl font-bold text-fg">{titleVal}</h1>
                      {Boolean(form.category) && <span className="text-xs text-fg-subtle uppercase">Category: {String(form.category)}</span>}
                    </div>
                    {statusVal && <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: sc?.color, background: sc?.bg }}>{statusVal}</span>}
                  </div>
                  {Boolean(form.trigger) && (
                    <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                      <span className="text-[11px] font-bold text-fg-subtle uppercase">Trigger Event</span>
                      <p className="text-xs text-fg font-mono">{String(form.trigger)}</p>
                    </div>
                  )}
                  {Boolean(form.description) && (
                    <div>
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase mb-1">Rule / Workflow Overview</h4>
                      <p className="text-sm text-fg leading-relaxed">{String(form.description)}</p>
                    </div>
                  )}
                  {Boolean(form.steps || form.action) && (
                    <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                      <span className="text-[11px] font-bold text-fg-subtle uppercase">Execution Steps / Action</span>
                      <p className="text-xs font-mono text-fg whitespace-pre-wrap">{String(form.steps || form.action)}</p>
                    </div>
                  )}
                </div>

              /* 8. Tech Stack */
              ) : slug === "tech-stack" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-fg">{titleVal}</h1>
                        {Boolean(form.version) && <Badge variant="neutral" size="sm">v{String(form.version)}</Badge>}
                      </div>
                      {Boolean(form.category) && <span className="text-xs text-fg-subtle uppercase">{String(form.category)} Layer</span>}
                    </div>
                    {statusVal && <span className="px-2.5 py-1 rounded text-xs font-semibold" style={{ color: sc?.color, background: sc?.bg }}>{statusVal}</span>}
                  </div>
                  {Boolean(form.description) && (
                    <div>
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase mb-1">Description</h4>
                      <p className="text-sm text-fg leading-relaxed">{String(form.description)}</p>
                    </div>
                  )}
                  {Boolean(form.rationale) && (
                    <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                      <span className="text-[11px] font-bold text-fg-subtle uppercase">Adoption Rationale</span>
                      <p className="text-xs text-fg leading-relaxed">{String(form.rationale)}</p>
                    </div>
                  )}
                </div>

              /* 9. Meeting Notes */
              ) : slug === "meeting-notes" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h1 className="text-xl font-bold text-fg">{titleVal}</h1>
                      <div className="text-xs text-fg-muted mt-0.5">
                        {Boolean(form.meetingDate) && <span>Date: <strong>{new Date(form.meetingDate as string).toLocaleDateString()}</strong></span>}
                        {Boolean(form.participants) && <span className="ml-3">Participants: <strong>{String(form.participants)}</strong></span>}
                      </div>
                    </div>
                  </div>
                  {Boolean(form.summary) && (
                    <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                      <h4 className="text-xs font-bold text-fg-subtle uppercase">Meeting Summary</h4>
                      <p className="text-xs text-fg leading-relaxed">{String(form.summary)}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Boolean(form.decisions) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Key Decisions</span>
                        <p className="text-xs text-fg leading-relaxed whitespace-pre-wrap">{String(form.decisions)}</p>
                      </div>
                    )}
                    {Boolean(form.actionItems) && (
                      <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                        <span className="text-[11px] font-bold text-fg-subtle uppercase">Action Items</span>
                        <p className="text-xs text-fg leading-relaxed whitespace-pre-wrap">{String(form.actionItems)}</p>
                      </div>
                    )}
                  </div>
                </div>

              /* 10. Risks & Ideas */
              ) : slug === "risks" || slug === "ideas" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {statusVal && <span className="px-2.5 py-0.5 rounded text-xs font-semibold" style={{ color: sc?.color, background: sc?.bg }}>{statusVal}</span>}
                        {Boolean(form.impact) && <Badge variant="neutral" size="sm">Impact: {String(form.impact)}</Badge>}
                        {Boolean(form.probability) && <Badge variant="neutral" size="sm">Prob: {String(form.probability)}</Badge>}
                        {Boolean(form.effort) && <Badge variant="neutral" size="sm">Effort: {String(form.effort)}/5</Badge>}
                      </div>
                      <h1 className="text-xl font-bold text-fg mt-1.5">{titleVal}</h1>
                    </div>
                  </div>
                  {Boolean(form.description) && (
                    <div>
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase mb-1">Description</h4>
                      <p className="text-sm text-fg leading-relaxed">{String(form.description)}</p>
                    </div>
                  )}
                  {Boolean(form.mitigationPlan) && (
                    <div className="p-3 rounded-md bg-bg border border-border space-y-1">
                      <span className="text-[11px] font-bold text-fg-subtle uppercase">Mitigation Strategy</span>
                      <p className="text-xs text-fg leading-relaxed">{String(form.mitigationPlan)}</p>
                    </div>
                  )}
                </div>

              /* 11. Tasks */
              ) : slug === "dev-tasks" ? (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {statusVal && <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: sc?.color, background: sc?.bg }}>{statusVal}</span>}
                        {Boolean(form.priority) && <Badge variant="neutral" size="sm">Priority: {String(form.priority)}</Badge>}
                      </div>
                      <h1 className="text-xl font-bold text-fg">{titleVal}</h1>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-md bg-bg border border-border text-xs">
                    <div><span className="text-fg-subtle font-semibold uppercase">Assignee:</span> <div className="font-medium text-fg">{relLabel({ relation: "users", key: "assigneeId", label: "Assignee", type: "relation" }, form.assigneeId, users, relations)}</div></div>
                    <div><span className="text-fg-subtle font-semibold uppercase">Start Date:</span> <div className="font-medium text-fg">{form.startDate ? new Date(form.startDate as string).toLocaleDateString() : "—"}</div></div>
                    <div><span className="text-fg-subtle font-semibold uppercase">Due Date:</span> <div className="font-medium text-fg">{form.dueDate ? new Date(form.dueDate as string).toLocaleDateString() : "—"}</div></div>
                    <div><span className="text-fg-subtle font-semibold uppercase">Estimate:</span> <div className="font-medium text-fg">{form.estimatedTime ? `${form.estimatedTime}h` : "—"}</div></div>
                  </div>
                  {Boolean(form.description) && (
                    <div>
                      <h4 className="text-xs font-semibold text-fg-subtle uppercase mb-1">Task Details</h4>
                      {renderReadonlyValue(meta.fields.find(f => f.key === "description")!, form.description)}
                    </div>
                  )}
                </div>

              ) : (
                /* Default Generic Detail Template */
                <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
                  <div className="border-b border-border pb-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {statusVal && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: sc?.color, background: sc?.bg }}>
                          {statusVal}
                        </span>
                      )}
                      {projKey && <Badge variant="neutral" size="sm">{projKey}</Badge>}
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-fg">{titleVal}</h1>
                  </div>

                  {primaryBodyField && Boolean(form[primaryBodyField.key]) && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-semibold text-fg-subtle uppercase">{primaryBodyField.label}</h3>
                      {renderReadonlyValue(primaryBodyField, form[primaryBodyField.key])}
                    </div>
                  )}

                  {headerAndMetaFields.filter((f) => Boolean(form[f.key])).length > 0 && (
                    <div className="pt-3 border-t border-border grid grid-cols-2 md:grid-cols-3 gap-3">
                      {headerAndMetaFields.map((f) => {
                        const val = form[f.key];
                        if (val == null || val === "") return null;
                        return (
                          <div key={f.key} className="space-y-0.5">
                            <span className="text-[10px] font-semibold text-fg-subtle uppercase">{f.label}</span>
                            <div className="text-xs">{renderReadonlyValue(f, val)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Compact Sidebar View */}
            <aside className="space-y-4">
              <div className="rounded-lg border border-border bg-surface p-4 space-y-4 text-xs">
                {projObj && (
                  <div>
                    <h3 className="font-semibold text-fg-subtle uppercase mb-1.5">Project</h3>
                    <Link href={`/projects/${form.projectId}?tab=workspace`} className="flex items-center justify-between p-2 rounded bg-bg-hover">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge variant="neutral" size="sm">{projObj.key}</Badge>
                        <span className="font-medium text-fg truncate">{projObj.name}</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-fg-muted" />
                    </Link>
                  </div>
                )}

                {meta.fields.filter((f) => f.relation && f.relation !== "users" && form[f.key]).length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <h3 className="font-semibold text-fg-subtle uppercase mb-1.5">Linked Items</h3>
                    <div className="space-y-1.5">
                      {meta.fields.filter((f) => f.relation && f.relation !== "users" && form[f.key]).map((f) => (
                        <Link key={f.key} href={`/pm/${f.relation}/${form[f.key]}`} className="flex items-center justify-between hover:text-accent">
                          <span className="text-fg-muted">{f.label}:</span>
                          <span className="font-medium text-accent truncate max-w-[120px]">{relLabel(f, form[f.key], users, relations)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {canWrite && childModules.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <h3 className="font-semibold text-fg-subtle uppercase mb-1.5">Quick Create</h3>
                    <div className="flex flex-col gap-1">
                      {childModules.map((c) => (
                        <Link key={c.slug} href={`/pm/${c.slug}/new?projectId=${form.projectId}&${c.fkKey}=${id}`} className="inline-flex items-center gap-1 text-fg-muted hover:text-fg py-1">
                          <Plus className="w-3 h-3" /> New {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title={`Delete ${meta?.singular ?? "Record"}`}
        message={`Are you sure you want to delete this ${meta?.singular.toLowerCase()}? This action cannot be undone.`}
      />
    </div>
  );
}

