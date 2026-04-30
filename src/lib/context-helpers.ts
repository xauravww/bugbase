import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectMembers, contextActivity, contextEntries, contextEntryEmbeddings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { embedSafe, distanceToSimilarity } from "@/lib/embeddings";
import { upsertVec, deleteVec, vecSearch } from "@/lib/sqlite-vec";

export const ERR = {
  unauth: () => NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 }),
  invalidId: () => NextResponse.json({ error: "Invalid project ID", code: "INVALID_ID" }, { status: 400 }),
  forbidden: (msg = "Forbidden") => NextResponse.json({ error: msg, code: "FORBIDDEN" }, { status: 403 }),
  notFound: (msg = "Not found") => NextResponse.json({ error: msg, code: "NOT_FOUND" }, { status: 404 }),
  validation: (msg: string) => NextResponse.json({ error: msg, code: "VALIDATION_ERROR" }, { status: 400 }),
  internal: () => NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 }),
};

export async function ensureProjectAccess(projectId: number, userId: number, userRole: string) {
  if (userRole === "Admin") return true;
  const m = await db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
  });
  return !!m;
}

export async function logContextActivity(
  projectId: number,
  entryId: number | null,
  userId: number,
  action: string,
  oldValue?: string | null,
  newValue?: string | null
) {
  await db.insert(contextActivity).values({
    projectId,
    entryId: entryId ?? undefined,
    userId,
    action,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  });
}

export async function syncEntryEmbedding(entryId: number, text: string) {
  const vec = await embedSafe(text);
  if (!vec) return;
  const model = process.env.LOCAL_LLM_EMBED_MODEL || "default";
  await db
    .insert(contextEntryEmbeddings)
    .values({ entryId, model, dim: vec.length, vector: JSON.stringify(Array.from(vec)) })
    .onConflictDoUpdate({
      target: contextEntryEmbeddings.entryId,
      set: { model, dim: vec.length, vector: JSON.stringify(Array.from(vec)) },
    });
  upsertVec(entryId, vec);
}

export async function deleteEntryEmbedding(entryId: number) {
  await db.delete(contextEntryEmbeddings).where(eq(contextEntryEmbeddings.entryId, entryId));
  deleteVec(entryId);
}

export interface SimilarHit {
  entryId: number;
  similarity: number;
  title: string | null;
  body: string;
  kind: string;
}

export async function findSimilar(projectId: number, text: string, k = 5, threshold = 0.78): Promise<SimilarHit[]> {
  const vec = await embedSafe(text);
  if (!vec) return [];
  const hits = vecSearch(vec, k * 2, projectId);
  if (hits.length === 0) return [];
  const ids = hits.map((h) => h.entryId);
  const rows = await db.query.contextEntries.findMany({
    where: (t, { inArray, eq, and }) => and(inArray(t.id, ids), eq(t.projectId, projectId)),
    columns: { id: true, title: true, body: true, kind: true },
  });
  const map = new Map(rows.map((r) => [r.id, r]));
  const out: SimilarHit[] = [];
  for (const h of hits) {
    const row = map.get(h.entryId);
    if (!row) continue;
    const sim = distanceToSimilarity(h.distance);
    if (sim < threshold) continue;
    out.push({
      entryId: row.id,
      similarity: sim,
      title: row.title,
      body: row.body.slice(0, 240),
      kind: row.kind,
    });
    if (out.length >= k) break;
  }
  return out;
}

export function chunkText(text: string, size = 1500): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}
