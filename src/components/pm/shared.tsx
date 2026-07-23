"use client";

import { useCallback, useEffect, useState } from "react";
import { Input, Select, Textarea } from "@/components/ui";
import { MarkdownEditor } from "./MarkdownEditor";
import { useAuth } from "@/contexts/AuthContext";
import { getMeta, titleField, type FieldDef, type ModuleMeta } from "@/lib/modules/meta";

export type Rec = Record<string, unknown>;
export interface ProjectOpt { id: number; name: string; key: string }
export interface UserOpt { id: number; name: string }

/**
 * Loads the option sets a module form needs: projects, users, and the record
 * lists for every module referenced by a relation field. Shared by the list
 * workspace and the full-page detail editor.
 */
export function usePmOptions(meta: ModuleMeta | undefined) {
  const { token } = useAuth();
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [relations, setRelations] = useState<Record<string, Rec[]>>({});
  const [loaded, setLoaded] = useState(false);

  const authHeaders = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token]
  );

  useEffect(() => {
    if (!token || !meta) return;
    (async () => {
      const [pRes, uRes] = await Promise.all([
        fetch("/api/projects?limit=200", { headers: authHeaders() }),
        fetch("/api/pm/users", { headers: authHeaders() }),
      ]);
      const pData = await pRes.json().catch(() => ({}));
      const uData = await uRes.json().catch(() => ({}));
      setProjects((pData.projects || []).map((p: ProjectOpt) => ({ id: p.id, name: p.name, key: p.key })));
      setUsers((uData.users || []).map((u: UserOpt) => ({ id: u.id, name: u.name })));

      const relSlugs = Array.from(new Set(meta.fields.filter((f) => f.relation && f.relation !== "users").map((f) => f.relation!)));
      const relData: Record<string, Rec[]> = {};
      await Promise.all(
        relSlugs.map(async (rs) => {
          const r = await fetch(`/api/pm/${rs}?limit=200`, { headers: authHeaders() });
          const d = await r.json().catch(() => ({}));
          relData[rs] = d.records || [];
        })
      );
      setRelations(relData);
      setLoaded(true);
    })();
  }, [token, meta, authHeaders]);

  return { projects, users, relations, loaded, authHeaders };
}

/** Resolve a relation FK to a human label. */
export function relLabel(
  f: FieldDef,
  val: unknown,
  users: UserOpt[],
  relations: Record<string, Rec[]>
): string {
  if (val == null || val === "") return "—";
  if (f.relation === "users") return users.find((u) => u.id === Number(val))?.name ?? `#${val}`;
  const list = relations[f.relation!] || [];
  const rec = list.find((r) => r.id === Number(val));
  if (!rec) return `#${val}`;
  const rm = getMeta(f.relation!);
  return String(rec[rm ? titleField(rm) : "id"] ?? `#${val}`);
}

/** One form control for a module field. Long text uses the MarkdownEditor. */
export function FieldInput({
  field, value, onChange, users, relations,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  users: UserOpt[];
  relations: Record<string, Rec[]>;
}) {
  const v = value ?? "";

  if (field.type === "tags") {
    return (
      <Input
        label={field.label}
        value={String(v)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? "Comma-separated tags"}
      />
    );
  }
  if (field.type === "select") {
    return (
      <Select
        label={field.label}
        value={String(v)}
        onChange={(e) => onChange(e.target.value)}
        options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
        placeholder={`Select ${field.label.toLowerCase()}`}
      />
    );
  }
  if (field.type === "relation") {
    let opts: { value: string; label: string }[] = [];
    if (field.relation === "users") {
      opts = users.map((u) => ({ value: String(u.id), label: u.name }));
    } else {
      const list = relations[field.relation!] || [];
      const rm = getMeta(field.relation!);
      const tk = rm ? titleField(rm) : "id";
      opts = list.map((r) => ({ value: String(r.id), label: String(r[tk] ?? `#${r.id}`) }));
    }
    return (
      <Select
        label={field.label}
        value={v ? String(v) : ""}
        onChange={(e) => onChange(e.target.value)}
        options={[{ value: "", label: "— None —" }, ...opts]}
        searchable
        placeholder={`Link ${field.label.toLowerCase()}`}
      />
    );
  }
  if (field.type === "richtext" || field.type === "textarea") {
    return (
      <MarkdownEditor
        label={field.label}
        value={String(v)}
        onChange={(nv) => onChange(nv)}
        placeholder={field.placeholder}
        minRows={field.type === "richtext" ? 14 : 8}
        mono={field.mono}
      />
    );
  }
  if (field.type === "date") {
    return <Input type="date" label={field.label} value={String(v)} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "number") {
    return <Input type="number" label={field.label} value={String(v)} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
  }
  return (
    <Input
      label={field.label}
      value={String(v)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={field.mono ? "font-mono text-sm" : undefined}
    />
  );
}
