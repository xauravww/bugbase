export type ContextKind =
  | "question"
  | "answer"
  | "note"
  | "ingest"
  | "ingest_chunk"
  | "treemap"
  | "task"
  | "feature"
  | "custom";

export interface ContextAttachment {
  url: string;
  thumbnail?: string;
  caption?: string;
  type?: "image" | "link";
}

export interface ContextEntryMetadata {
  attachments?: ContextAttachment[];
  references?: { url: string; label?: string }[];
  [k: string]: unknown;
}

export type ContextSource = "user" | "ai" | "admin_pin";

/**
 * Represents a context entry in the project workspace.
 *
 * Context entries can be questions, notes, tasks, etc., and support lifecycle management:
 * - Active: Default state for new entries
 * - Completed: For entries that have been addressed or resolved
 * - Archived: For entries that are no longer relevant but kept for reference
 *
 * Admins can change status, pin entries, and manage visibility.
 */
export interface ContextEntry {
  id: number;
  projectId: number;
  kind: ContextKind;
  parentId: number | null;
  title: string | null;
  body: string;
  source: ContextSource;
  /** Lifecycle status of the entry */
  status: "active" | "completed" | "archived";
  /** Whether the entry is pinned (admin-only) */
  pinned: boolean;
  metadata: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  creator?: { id: number; name: string; email: string };
}

export interface SimilarHit {
  entryId: number;
  similarity: number;
  title: string | null;
  body: string;
  kind: ContextKind;
}

export interface TreemapPathRow {
  id: number;
  projectId: number;
  path: string;
  tested: boolean;
  notes: string | null;
  lastTestedAt: string | null;
  updatedAt: string;
}

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  depth: number;
  children: TreeNode[];
}
