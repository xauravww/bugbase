/**
 * Server-side module registry — attaches the drizzle table ref to each
 * client-safe ModuleMeta entry (src/lib/modules/meta.ts). Used only by the
 * API layer. The UI imports meta.ts directly to avoid pulling drizzle into
 * the client bundle.
 */
import * as pm from "@/lib/db/pm-schema";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { MODULE_META, type ModuleMeta } from "./meta";

export type { FieldDef, FieldType, ViewKind, ModuleMeta } from "./meta";
export { titleField } from "./meta";

export interface ModuleDef extends ModuleMeta {
  table: SQLiteTable;
}

const TABLES: Record<string, SQLiteTable> = {
  requirements: pm.requirements,
  features: pm.features,
  "dev-tasks": pm.devTasks,
  bugs: pm.bugs,
  releases: pm.releases,
  "api-docs": pm.apiDocs,
  "arch-docs": pm.archDocs,
  "meeting-notes": pm.meetingNotes,
  risks: pm.risks,
  ideas: pm.ideas,
  milestones: pm.milestones,
  sprints: pm.sprints,
};

export const MODULES: Record<string, ModuleDef> = Object.fromEntries(
  Object.entries(MODULE_META).map(([slug, meta]) => [slug, { ...meta, table: TABLES[slug] }])
) as Record<string, ModuleDef>;

export const MODULE_LIST = Object.values(MODULES);

export function getModule(slug: string): ModuleDef | undefined {
  return MODULES[slug];
}

export function dateFields(m: ModuleDef): string[] {
  return m.fields.filter((f) => f.type === "date").map((f) => f.key);
}

export function numberFields(m: ModuleDef): string[] {
  return m.fields.filter((f) => f.type === "number").map((f) => f.key);
}
