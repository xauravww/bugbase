"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, Trash2, Pencil, LayoutGrid, Table as TableIcon, List as ListIcon, X, Search, ChevronLeft, ChevronRight, Hash, CalendarClock } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, IconButton, Select, Badge, EmptyState, PageLoader, useToast, ConfirmDialog } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getMeta, titleField, listFields, type FieldDef, type ModuleMeta, type ViewKind } from "@/lib/modules/meta";
import { enumColor } from "@/lib/modules/colors";
import { usePmOptions, relLabel, type Rec } from "./shared";
import { ModuleHelpButton } from "./ModuleHelpButton";
import { cn } from "@/lib/utils/cn";

const VIEW_ICON: Partial<Record<ViewKind, typeof TableIcon>> = {
  table: TableIcon,
  kanban: LayoutGrid,
  list: ListIcon,
};

type WorkspaceKind = "delivery" | "documentation" | "discovery" | "decision";

const LIST_FIRST_MODULES = new Set([
  "api-docs", "arch-docs", "meeting-notes", "personas", "user-journeys",
  "tech-stack", "mockups", "risks", "ideas", "workflows", "business-rules",
]);

function workspaceKind(slug: string): WorkspaceKind {
  if (["api-docs", "arch-docs", "meeting-notes"].includes(slug)) return "documentation";
  if (["personas", "user-journeys", "tech-stack", "mockups"].includes(slug)) return "discovery";
  if (["risks", "ideas", "workflows", "business-rules"].includes(slug)) return "decision";
  return "delivery";
}

interface Props {
  slug: string;
  /** When embedded in a project page: scope to one project + hide chrome. */
  fixedProjectId?: number;
  /** Hide the page Header (embedded mode supplies its own). */
  embedded?: boolean;
}

export function ModuleWorkspace({ slug, fixedProjectId, embedded }: Props) {
  const meta = getMeta(slug);
  const { token, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { projects, users, relations, authHeaders } = usePmOptions(meta);

  const [records, setRecords] = useState<Rec[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const hasLoadedRecords = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<Rec | null>(null);

  const useSp = <T,>(key: string, fallback: T): [T, (v: T) => void] => {
    const raw = searchParams.get(key);
    const [value, setValue] = useState<T>(raw !== null ? (raw as unknown as T) : fallback);

    // Sync from searchParams when browser back/forward changes them
    useEffect(() => {
      const next = searchParams.get(key);
      setValue((prev) => {
        const nv = next !== null ? (next as unknown as T) : fallback;
        return nv !== prev ? nv : prev;
      });
    }, [searchParams, key, fallback]);

    const update = useCallback((v: T) => {
      setValue(v);
      const sp = new URLSearchParams(globalThis.location?.search ?? "");
      const s = String(v);
      if (s === String(fallback)) sp.delete(key);
      else sp.set(key, s);
      const q = sp.toString();
      const url = q ? `${pathname}?${q}` : pathname;
      globalThis.history?.replaceState(null, "", url);
    }, [pathname, key, fallback]);

    return [value, update];
  };

  // Scope workspace state in the URL. The project page already uses generic
  // keys such as `status` for its Issues tab, so sharing those keys caused the
  // Requirements status filter to be overwritten during navigation.
  const defaultView: ViewKind = LIST_FIRST_MODULES.has(slug) ? "list" : "table";
  const [view, setView] = useSp<ViewKind>("wsView", defaultView);
  const [search, setSearch] = useSp("wsSearch", "");
  const [projectId, setProjectId] = useSp("wsProjectId", fixedProjectId ? String(fixedProjectId) : "all");
  const [statusFilter, setStatusFilter] = useSp("wsStatus", "all");
  const [priorityFilter, setPriorityFilter] = useSp("wsPriority", "all");
  const [tagFilter, setTagFilter] = useSp("wsTag", "all");
  const [sort, setSort] = useSp("wsSort", meta?.defaultSort ?? "updatedAt");
  const [dir, setDir] = useSp<"asc" | "desc">("wsDir", "desc");
  const [page, setPage] = useSp("wsPage", "1");

  const [debounced, setDebounced] = useState(search);

  const canWrite = user?.role !== "Viewer";
  const priorityKey = useMemo(
    () => meta?.fields.find((f) => ["priority", "severity"].includes(f.key))?.key,
    [meta]
  );
  const statusOptions = useMemo(
    () => meta?.fields.find((f) => f.key === meta.statusKey)?.options ?? [],
    [meta]
  );
  const priorityOptions = useMemo(
    () => (priorityKey ? meta?.fields.find((f) => f.key === priorityKey)?.options ?? [] : []),
    [meta, priorityKey]
  );
  const tagsFieldKey = useMemo(
    () => meta?.fields.find((f) => f.type === "tags")?.key,
    [meta]
  );
  const tagOptions = useMemo(() => {
    if (!tagsFieldKey) return [];
    const all = new Set<string>();
    for (const r of records) {
      const raw = r[tagsFieldKey];
      if (typeof raw === "string" && raw.trim()) {
        for (const t of raw.split(",")) {
          const trimmed = t.trim();
          if (trimmed) all.add(trimmed);
        }
      }
    }
    return Array.from(all).sort();
  }, [records, tagsFieldKey]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRecords = useCallback(async () => {
    if (!token || !meta) return;
    // Filters should refresh the rows in place. Showing the full loader on
    // every filter change makes the workspace look like it has reloaded.
    if (!hasLoadedRecords.current) setLoading(true);
    const qs = new URLSearchParams();
    const scoped = fixedProjectId ? String(fixedProjectId) : projectId;
    if (scoped !== "all") qs.set("projectId", scoped);
    if (debounced) qs.set("search", debounced);
    if (statusFilter !== "all" && meta.statusKey) qs.set(meta.statusKey, statusFilter);
    if (priorityFilter !== "all" && priorityKey) qs.set(priorityKey, priorityFilter);
    if (tagFilter !== "all" && tagsFieldKey) qs.set(tagsFieldKey, tagFilter);
    qs.set("sort", sort);
    qs.set("dir", dir);
    qs.set("page", page);
    qs.set("limit", String(20));
    try {
      const res = await fetch(`/api/pm/${slug}?${qs}`, { headers: authHeaders() });
      const data = await res.json();
      setRecords(data.records || []);
      const nextPagination = data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };
      setPagination((current) =>
        current.page === nextPagination.page &&
        current.limit === nextPagination.limit &&
        current.total === nextPagination.total &&
        current.totalPages === nextPagination.totalPages
          ? current
          : nextPagination
      );
    } catch {
      toast.error("Failed to load");
    } finally {
      hasLoadedRecords.current = true;
      setLoading(false);
    }
  }, [token, meta, slug, fixedProjectId, projectId, debounced, statusFilter, priorityFilter, priorityKey, tagFilter, tagsFieldKey, sort, dir, page, authHeaders, toast]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    if (page !== "1") setPage("1");
  }, [slug, fixedProjectId, projectId, debounced, statusFilter, priorityFilter, tagFilter, sort, dir]);

  // When embedded in a project, remember where to return so the record
  // detail's back button lands back on this project workspace + module chip,
  // preserving any active filter/search/pagination state in the URL.
  const fromParam = useCallback(() => {
    if (!embedded || !fixedProjectId) return "";
    const current = new URLSearchParams(globalThis.location?.search ?? "");
    current.set("tab", "workspace");
    current.set("wsmod", slug);
    return `&from=${encodeURIComponent(`/projects/${fixedProjectId}?${current.toString()}`)}`;
  }, [embedded, fixedProjectId, slug]);

  const createUrl = useCallback(() => {
    const scoped = fixedProjectId ? String(fixedProjectId) : (projectId !== "all" ? projectId : "");
    const q = [scoped ? `projectId=${scoped}` : "", fromParam().replace(/^&/, "")].filter(Boolean).join("&");
    return `/pm/${slug}/new${q ? `?${q}` : ""}`;
  }, [slug, fixedProjectId, projectId, fromParam]);

  const goCreate = () => router.push(createUrl());
  const goDetail = (rec: Rec) => {
    const from = fromParam().replace(/^&/, "");
    const listParams = new URLSearchParams(globalThis.location?.search ?? "");
    listParams.delete("wsView");
    const qp = listParams.toString();
    router.push(`/pm/${slug}/${rec.id}${from || qp ? `?${from}${qp ? `&${qp}` : ""}` : ""}`);
  };

  const remove = async (rec: Rec, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(rec);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const rec = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/pm/${slug}/${rec.id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error();
      toast.success("Deleted");
      setRecords((r) => r.filter((x) => x.id !== rec.id));
    } catch {
      toast.error("Delete failed");
    }
  };

  if (!meta) return <div className="p-6">Unknown module.</div>;

  const tKey = titleField(meta);
  const titleFd = meta.fields.find((f) => f.key === tKey);
  const cols = listFields(meta);
  const projName = (id: unknown) => projects.find((p) => p.id === Number(id))?.key ?? "—";

  const cellValue = (rec: Rec, f: FieldDef): React.ReactNode => {
    const v = rec[f.key];
    if (f.relation) return relLabel(f, v, users, relations);
    if (f.type === "date") return v ? new Date(v as string).toLocaleDateString() : "—";
    if (f.key === meta.statusKey || f.key === priorityKey) {
      const c = enumColor(v as string);
      const display = v && f.options ? f.options.find(o => o.toLowerCase() === String(v).toLowerCase()) ?? String(v) : String(v);
      return v ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ color: c.color, background: c.bg }}>{display}</span>
      ) : "—";
    }
    if (f.type === "tags" && typeof v === "string" && v.trim()) {
      const tags = v.split(",").map((t) => t.trim()).filter(Boolean);
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-subtle text-fg-muted whitespace-nowrap">
              <Hash className="w-2.5 h-2.5" />{t}
            </span>
          ))}
        </span>
      );
    }
    return v == null || v === "" ? "—" : String(v);
  };

  const groups = meta.statusKey
    ? (statusOptions.length ? statusOptions : ["—"]).map((s) => ({
        key: s,
        items: records.filter((r) => (r[meta.statusKey!] ?? "—") === s),
      }))
    : [];

  const toolbar = (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      {embedded && <ModuleHelpButton slug={slug} variant="labelled" className="w-full justify-center sm:w-auto sm:shrink-0" />}
      {embedded && (
        <div className="relative w-full sm:min-w-[220px] sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            aria-label={`Search ${meta.label.toLowerCase()}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${meta.label.toLowerCase()}…`}
            className="w-full rounded-md border border-border bg-bg py-2 pl-9 pr-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-accent"
          />
        </div>
      )}
      <div className="flex w-fit items-center gap-0.5 rounded-md bg-bg-hover p-0.5">
        {meta.views.filter((v) => VIEW_ICON[v]).map((v) => {
          const Icon = VIEW_ICON[v]!;
          return (
            <button
              key={v} onClick={() => setView(v)} title={v}
              className={cn("p-1.5 rounded cursor-pointer transition-colors", view === v ? "bg-bg text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {!fixedProjectId && (
        <Select
          aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}
          options={[{ value: "all", label: "All projects" }, ...projects.map((p) => ({ value: String(p.id), label: `${p.key} · ${p.name}` }))]}
          wrapperClassName="w-full sm:w-auto sm:min-w-[160px]" searchable
        />
      )}

      {meta.statusKey && statusOptions.length > 0 && (
        <Select
          aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          options={[{ value: "all", label: "All status" }, ...statusOptions.map((s) => ({ value: s, label: s }))]}
          wrapperClassName="w-full sm:w-auto sm:min-w-[140px]"
        />
      )}

      {priorityKey && priorityOptions.length > 0 && (
        <Select
          aria-label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          options={[{ value: "all", label: "All priority" }, ...priorityOptions.map((s) => ({ value: s, label: s }))]}
          wrapperClassName="w-full sm:w-auto sm:min-w-[140px]"
        />
      )}

      {tagsFieldKey && (
        <Select
          aria-label="Tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
          options={[{ value: "all", label: "All tags" }, ...tagOptions.map((t) => ({ value: t, label: t }))]}
          wrapperClassName="w-full sm:w-auto sm:min-w-[140px]" searchable
        />
      )}

      <Select
        aria-label="Sort" value={`${sort}:${dir}`}
        onChange={(e) => { const [s, d] = e.target.value.split(":"); setSort(s); setDir(d as "asc" | "desc"); }}
        options={[
          { value: "updatedAt:desc", label: "Recently updated" },
          { value: "createdAt:desc", label: "Newest" },
          { value: "createdAt:asc", label: "Oldest" },
          { value: `${tKey}:asc`, label: "Title A–Z" },
        ]}
        wrapperClassName="w-full sm:w-auto sm:min-w-[150px]"
      />

      {(statusFilter !== "all" || priorityFilter !== "all" || tagFilter !== "all" || (!fixedProjectId && projectId !== "all") || search) && (
        <Button variant="ghost" size="sm" leftIcon={X} onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setTagFilter("all"); if (!fixedProjectId) setProjectId("all"); setSearch(""); setPage("1"); }}>Clear</Button>
      )}

      {!embedded && (
        <>
          <Button
            variant="outline"
            size="sm"
            leftIcon={CalendarClock}
            onClick={() => router.push(projectId !== "all" ? `/timeline?projectId=${projectId}` : "/timeline")}
          >
            Go to Timeline
          </Button>
          <Button variant="primary" size="sm" leftIcon={Plus} onClick={goCreate}>New {meta.singular}</Button>
          <span className="ml-auto text-sm text-fg-muted">{pagination.total} {pagination.total === 1 ? meta.singular.toLowerCase() : meta.label.toLowerCase()}</span>
        </>
      )}
    </div>
  );

  const handleStatusChange = async (rec: Rec, newStatus: string) => {
    if (!meta.statusKey || !canWrite) return;
    const oldStatus = rec[meta.statusKey];
    // Optimistic UI update
    setRecords((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, [meta.statusKey!]: newStatus } : r))
    );
    try {
      const res = await fetch(`/api/pm/${slug}/${rec.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ [meta.statusKey]: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update status");
      }
      toast.success(`Updated status to ${newStatus}`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to update status");
      // Revert optimistic update
      setRecords((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, [meta.statusKey!]: oldStatus } : r))
      );
    }
  };

  const body = loading ? (
    <PageLoader />
  ) : records.length === 0 ? (
    <EmptyState
      title={`No ${meta.label.toLowerCase()} yet`}
      description={canWrite ? `Create your first ${meta.singular.toLowerCase()} to get started.` : "Nothing here yet."}
    />
  ) : view === "kanban" && meta.statusKey ? (
    <KanbanBoard groups={groups} meta={meta} tKey={tKey} priorityKey={priorityKey} projName={projName} cellValue={cellValue} onOpen={goDetail} onStatusChange={handleStatusChange} />
  ) : view === "list" ? (
    <ModuleList
      records={records}
      meta={meta}
      kind={workspaceKind(slug)}
      titleKey={tKey}
      titleField={titleFd}
      listColumns={cols}
      canWrite={canWrite}
      projectName={projName}
      cellValue={cellValue}
      onOpen={goDetail}
      onRemove={remove}
    />
  ) : (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-hover text-left">
            <th className="px-4 py-2.5 font-medium text-fg-muted">{titleFd?.label}</th>
            {!fixedProjectId && <th className="px-4 py-2.5 font-medium text-fg-muted">Project</th>}
            {cols.filter((c) => c.key !== tKey).map((c) => (
              <th key={c.key} className="px-4 py-2.5 font-medium text-fg-muted whitespace-nowrap">{c.label}</th>
            ))}
            {canWrite && <th className="px-4 py-2.5 w-20" />}
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => (
            <tr key={String(rec.id)} onClick={() => goDetail(rec)} className="border-b border-border last:border-0 hover:bg-bg-hover group cursor-pointer">
              <td className="px-4 py-2.5">
                <span className={cn("text-fg font-medium group-hover:text-accent", titleFd?.mono && "font-mono text-xs")}>{String(rec[tKey])}</span>
              </td>
              {!fixedProjectId && <td className="px-4 py-2.5"><Badge variant="neutral" size="sm">{projName(rec.projectId)}</Badge></td>}
              {cols.filter((c) => c.key !== tKey).map((c) => (
                <td key={c.key} className="px-4 py-2.5 whitespace-nowrap text-fg-muted">{cellValue(rec, c)}</td>
              ))}
              {canWrite && (
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <IconButton icon={Pencil} label="Edit" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); goDetail(rec); }} />
                    <IconButton icon={Trash2} label="Delete" variant="ghost" size="sm" onClick={(e) => remove(rec, e)} />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const pager = pagination.totalPages > 1 ? (
    <div className="flex flex-col gap-3 border-t border-border pt-3 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" leftIcon={ChevronLeft} disabled={pagination.page <= 1} onClick={() => setPage(String(pagination.page - 1))}>Previous</Button>
        <span className="tabular-nums">Page {pagination.page} of {pagination.totalPages}</span>
        <Button variant="secondary" size="sm" rightIcon={ChevronRight} disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(String(pagination.page + 1))}>Next</Button>
      </div>
    </div>
  ) : null;

  const deleteConfirm = (
    <ConfirmDialog
      isOpen={!!deleteTarget}
      onClose={() => setDeleteTarget(null)}
      onConfirm={confirmDelete}
      title={`Delete ${meta?.singular ?? "Record"}`}
      message={`Delete this ${meta?.singular.toLowerCase()}?`}
    />
  );

  if (embedded) {
    return <div className="space-y-4">{toolbar}{body}{pager}{deleteConfirm}</div>;
  }

  return (
    <>
      <Header title={meta.label} searchValue={search} onSearchChange={setSearch} searchPlaceholder={`Search ${meta.label.toLowerCase()}…`}>
        <ModuleHelpButton slug={slug} variant="labelled" />
        {canWrite && <Button variant="primary" size="sm" leftIcon={Plus} onClick={goCreate}>New {meta.singular}</Button>}
      </Header>
      <div className="p-4 md:p-6 space-y-4">{toolbar}{body}{pager}</div>
      {deleteConfirm}
    </>
  );
}

function ModuleList({
  records, meta, kind, titleKey, titleField, listColumns, canWrite, projectName, cellValue, onOpen, onRemove,
}: {
  records: Rec[];
  meta: ModuleMeta;
  kind: WorkspaceKind;
  titleKey: string;
  titleField?: FieldDef;
  listColumns: FieldDef[];
  canWrite: boolean;
  projectName: (id: unknown) => string;
  cellValue: (rec: Rec, field: FieldDef) => React.ReactNode;
  onOpen: (rec: Rec) => void;
  onRemove: (rec: Rec, event: React.MouseEvent) => void;
}) {
  if (kind === "documentation") {
    return <DocumentationList records={records} meta={meta} titleKey={titleKey} canWrite={canWrite} onOpen={onOpen} onRemove={onRemove} />;
  }
  if (kind === "discovery") {
    return <DiscoveryList records={records} meta={meta} titleKey={titleKey} canWrite={canWrite} onOpen={onOpen} onRemove={onRemove} />;
  }
  if (kind === "decision") {
    return <DecisionList records={records} meta={meta} titleKey={titleKey} canWrite={canWrite} onOpen={onOpen} onRemove={onRemove} />;
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {records.map((rec) => (
        <div key={String(rec.id)} onClick={() => onOpen(rec)} className="group flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-bg-hover">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("truncate font-medium text-fg", titleField?.mono && "font-mono text-sm")}>{String(rec[titleKey])}</span>
              <Badge variant="neutral" size="sm">{projectName(rec.projectId)}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              {listColumns.filter((c) => c.key !== titleKey).map((c) => <span key={c.key}>{cellValue(rec, c)}</span>)}
            </div>
          </div>
          <CardActions record={rec} canWrite={canWrite} onOpen={onOpen} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

function CardActions({ record, canWrite, onOpen, onRemove }: {
  record: Rec;
  canWrite: boolean;
  onOpen: (rec: Rec) => void;
  onRemove: (rec: Rec, event: React.MouseEvent) => void;
}) {
  if (!canWrite) return null;
  return (
    <div className="flex shrink-0 items-center gap-1 opacity-100">
      <IconButton icon={Pencil} label="Edit" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); onOpen(record); }} />
      <IconButton icon={Trash2} label="Delete" variant="ghost" size="sm" onClick={(event) => onRemove(record, event)} />
    </div>
  );
}

function DocumentationList({ records, meta, titleKey, canWrite, onOpen, onRemove }: {
  records: Rec[]; meta: ModuleMeta; titleKey: string; canWrite: boolean;
  onOpen: (rec: Rec) => void; onRemove: (rec: Rec, event: React.MouseEvent) => void;
}) {
  const isApi = meta.slug === "api-docs";
  const bodyKey = isApi ? "responseBody" : meta.slug === "meeting-notes" ? "summary" : "content";
  return (
    <div className={cn("grid gap-3", isApi ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2")}>
      {records.map((rec) => {
        const status = meta.statusKey ? String(rec[meta.statusKey] ?? "") : "";
        const statusStyle = enumColor(status);
        const excerpt = recordExcerpt(rec[bodyKey]);
        return (
          <div key={String(rec.id)} role="button" tabIndex={0} onClick={() => onOpen(rec)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(rec); }} className="group relative cursor-pointer rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-bg-hover">
            <div className="mb-2 flex flex-wrap items-center gap-2 pr-16">
              {isApi && <MethodBadge method={String(rec.httpMethod ?? "GET")} />}
              <span className={cn("font-medium text-fg", isApi && "font-mono text-sm")}>{String(rec[titleKey])}</span>
              {status && <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ color: statusStyle.color, background: statusStyle.bg }}>{status}</span>}
            </div>
            {isApi ? (
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-muted">
                <span><span className="font-medium text-fg">Auth</span> · {String(rec.authentication ?? "None")}</span>
                <span>{rec.requestBody ? "Request schema" : "No request body"}</span>
                <span>{rec.responseBody ? "Response schema" : "No response schema"}</span>
              </div>
            ) : (
              <>
                <div className="text-xs font-medium text-fg-muted">{meta.slug === "meeting-notes" ? String(rec.meetingDate ?? "Undated") : String(rec.category ?? "Document")}</div>
                {excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-fg-muted">{excerpt}</p>}
              </>
            )}
            <div className="absolute right-2 top-2"><CardActions record={rec} canWrite={canWrite} onOpen={onOpen} onRemove={onRemove} /></div>
          </div>
        );
      })}
    </div>
  );
}

function DiscoveryList({ records, meta, titleKey, canWrite, onOpen, onRemove }: {
  records: Rec[]; meta: ModuleMeta; titleKey: string; canWrite: boolean;
  onOpen: (rec: Rec) => void; onRemove: (rec: Rec, event: React.MouseEvent) => void;
}) {
  const detailKeys: Record<string, string[]> = {
    personas: ["role", "goals"], "user-journeys": ["stage", "persona"], "tech-stack": ["category", "version"], mockups: ["screen", "url"],
  };
  const keys = detailKeys[meta.slug] ?? [];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {records.map((rec) => (
        <div key={String(rec.id)} role="button" tabIndex={0} onClick={() => onOpen(rec)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(rec); }} className="group relative cursor-pointer rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-bg-hover">
          <div className="pr-14 text-base font-medium text-fg">{String(rec[titleKey])}</div>
          <div className="mt-3 space-y-2 text-sm text-fg-muted">
            {keys.map((key) => rec[key] ? <div key={key} className="flex gap-2"><span className="shrink-0 text-xs font-medium uppercase tracking-wide text-fg-subtle">{fieldLabel(meta, key)}</span><span className="truncate">{String(rec[key])}</span></div> : null)}
          </div>
          {recordExcerpt(rec.description ?? rec.painPoints ?? rec.rationale) && <p className="mt-3 line-clamp-2 text-sm leading-5 text-fg-muted">{recordExcerpt(rec.description ?? rec.painPoints ?? rec.rationale)}</p>}
          <div className="absolute right-2 top-2"><CardActions record={rec} canWrite={canWrite} onOpen={onOpen} onRemove={onRemove} /></div>
        </div>
      ))}
    </div>
  );
}

function DecisionList({ records, meta, titleKey, canWrite, onOpen, onRemove }: {
  records: Rec[]; meta: ModuleMeta; titleKey: string; canWrite: boolean;
  onOpen: (rec: Rec) => void; onRemove: (rec: Rec, event: React.MouseEvent) => void;
}) {
  const metrics: Record<string, string[]> = {
    risks: ["impact", "probability", "status"], ideas: ["impact", "effort", "priority"], workflows: ["trigger", "status"], "business-rules": ["category", "status"],
  };
  const keys = metrics[meta.slug] ?? [];
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {records.map((rec) => (
        <div key={String(rec.id)} role="button" tabIndex={0} onClick={() => onOpen(rec)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(rec); }} className="group relative cursor-pointer rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-bg-hover">
          <div className="pr-14 text-base font-medium text-fg">{String(rec[titleKey])}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {keys.map((key) => rec[key] ? <span key={key} className="rounded bg-bg-subtle px-2 py-1 text-xs text-fg-muted"><span className="font-medium text-fg">{fieldLabel(meta, key)}</span> · {String(rec[key])}</span> : null)}
          </div>
          {recordExcerpt(rec.description ?? rec.mitigationPlan ?? rec.condition ?? rec.steps) && <p className="mt-3 line-clamp-2 text-sm leading-5 text-fg-muted">{recordExcerpt(rec.description ?? rec.mitigationPlan ?? rec.condition ?? rec.steps)}</p>}
          <div className="absolute right-2 top-2"><CardActions record={rec} canWrite={canWrite} onOpen={onOpen} onRemove={onRemove} /></div>
        </div>
      ))}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = { GET: "bg-blue-50 text-blue-700", POST: "bg-emerald-50 text-emerald-700", PUT: "bg-amber-50 text-amber-700", PATCH: "bg-violet-50 text-violet-700", DELETE: "bg-red-50 text-red-700" };
  return <span className={cn("rounded px-2 py-0.5 font-mono text-xs font-semibold", colors[method] ?? "bg-bg-subtle text-fg-muted")}>{method}</span>;
}

function fieldLabel(meta: ModuleMeta, key: string) {
  return meta.fields.find((field) => field.key === key)?.label ?? key;
}

function recordExcerpt(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[#*_`>-]/g, " ").replace(/\s+/g, " ").trim();
}

function KanbanBoard({
  groups, meta, tKey, priorityKey, projName, cellValue, onOpen, onStatusChange,
}: {
  groups: { key: string; items: Rec[] }[];
  meta: ModuleMeta;
  tKey: string;
  priorityKey?: string;
  projName: (id: unknown) => string;
  cellValue: (rec: Rec, f: FieldDef) => React.ReactNode;
  onOpen: (rec: Rec) => void;
  onStatusChange: (rec: Rec, newStatus: string) => void;
}) {
  const [draggedRecId, setDraggedRecId] = useState<number | string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const onDragStart = (e: React.DragEvent, rec: Rec) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: rec.id, status: meta.statusKey ? rec[meta.statusKey] : null }));
    e.dataTransfer.effectAllowed = "move";
    setDraggedRecId(rec.id as number | string);
  };

  const onDragEnd = () => {
    setDraggedRecId(null);
    setDragOverCol(null);
  };

  const onDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colKey) {
      setDragOverCol(colKey);
    }
  };

  const onDragLeave = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (dragOverCol === colKey) {
      setDragOverCol(null);
    }
  };

  const onDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggedRecId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (!data || !data.id) return;
      const targetGroup = groups.flatMap((g) => g.items).find((r) => String(r.id) === String(data.id));
      if (targetGroup && meta.statusKey && targetGroup[meta.statusKey] !== newStatus) {
        onStatusChange(targetGroup, newStatus);
      }
    } catch {
      // Ignore parse error
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {groups.map((g) => {
        const c = enumColor(g.key);
        const isOver = dragOverCol === g.key;
        return (
          <div
            key={g.key}
            onDragOver={(e) => onDragOver(e, g.key)}
            onDragLeave={(e) => onDragLeave(e, g.key)}
            onDrop={(e) => onDrop(e, g.key)}
            className={cn(
              "flex-shrink-0 w-72 bg-bg-hover rounded-lg p-2 transition-colors duration-150 border-2 border-transparent",
              isOver && "border-accent bg-accent/5"
            )}
          >
            <div className="flex items-center justify-between px-2 py-1.5 mb-1">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                {g.key}
              </span>
              <span className="text-xs text-fg-muted">{g.items.length}</span>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {g.items.map((rec) => {
                const isDragging = String(draggedRecId) === String(rec.id);
                return (
                  <div
                    key={String(rec.id)}
                    draggable
                    onDragStart={(e) => onDragStart(e, rec)}
                    onDragEnd={onDragEnd}
                    onClick={() => onOpen(rec)}
                    className={cn(
                      "w-full text-left bg-bg rounded-md border border-border p-3 hover:border-accent transition-all cursor-grab active:cursor-grabbing",
                      isDragging && "opacity-40 scale-95 border-dashed border-accent"
                    )}
                  >
                    <div className="font-medium text-sm text-fg mb-1.5 line-clamp-2">{String(rec[tKey])}</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="neutral" size="sm">{projName(rec.projectId)}</Badge>
                      {priorityKey && rec[priorityKey] ? cellValue(rec, meta.fields.find((f) => f.key === priorityKey)!) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
