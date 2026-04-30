import { sqliteRaw, vecAvailable } from "@/lib/db";

const VEC_DIM = 768;

export function packVector(vec: Float32Array | number[]): Buffer {
  const arr = vec instanceof Float32Array ? vec : Float32Array.from(vec);
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

export function unpackVector(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

export function upsertVec(entryId: number, vector: Float32Array): void {
  if (!vecAvailable()) return;
  sqliteRaw.prepare("DELETE FROM context_vec WHERE entry_id = ?").run(entryId);
  sqliteRaw
    .prepare("INSERT INTO context_vec(entry_id, embedding) VALUES (?, ?)")
    .run(entryId, packVector(vector));
}

export function deleteVec(entryId: number): void {
  if (!vecAvailable()) return;
  sqliteRaw.prepare("DELETE FROM context_vec WHERE entry_id = ?").run(entryId);
}

export interface VecHit {
  entryId: number;
  distance: number;
}

export function vecSearch(queryVec: Float32Array, k = 5, projectId?: number): VecHit[] {
  if (!vecAvailable()) return [];
  const limit = Math.max(1, Math.min(50, k));
  if (projectId == null) {
    const rows = sqliteRaw
      .prepare(
        "SELECT entry_id as entryId, distance FROM context_vec WHERE embedding MATCH ? AND k = ? ORDER BY distance"
      )
      .all(packVector(queryVec), limit) as Array<{ entryId: number; distance: number }>;
    return rows;
  }
  const rows = sqliteRaw
    .prepare(
      `SELECT v.entry_id as entryId, v.distance as distance
       FROM (SELECT entry_id, distance FROM context_vec WHERE embedding MATCH ? AND k = ? ORDER BY distance) v
       INNER JOIN context_entries e ON e.id = v.entry_id
       WHERE e.project_id = ?`
    )
    .all(packVector(queryVec), Math.max(limit * 4, 20), projectId) as Array<{ entryId: number; distance: number }>;
  return rows.slice(0, limit);
}

export const VECTOR_DIM = VEC_DIM;
