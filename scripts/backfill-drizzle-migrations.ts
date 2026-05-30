#!/usr/bin/env tsx
/**
 * Backfill drizzle's __drizzle_migrations table when the schema was
 * previously applied via `db:push` (or any out-of-band path) and the
 * migration log is empty.
 *
 * Idempotent: skips entries whose hash already exists.
 *
 * Usage:
 *   DATABASE_PATH=./bugbase.db npx tsx scripts/backfill-drizzle-migrations.ts
 *   # or just:
 *   npx tsx scripts/backfill-drizzle-migrations.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = process.env.DATABASE_PATH || "./bugbase.db";
const DRIZZLE_DIR = process.env.DRIZZLE_DIR || "./drizzle";

type JournalEntry = { idx: number; tag: string; when: number };

function loadJournal(): JournalEntry[] {
  const p = path.join(DRIZZLE_DIR, "meta", "_journal.json");
  if (!fs.existsSync(p)) {
    throw new Error(`journal not found at ${p}`);
  }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return j.entries as JournalEntry[];
}

// Drizzle hashes the raw SQL file content (sha256 hex).
function hashSql(sql: string): string {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`database not found at ${DB_PATH}`);
  }

  const db = new Database(DB_PATH);
  db.exec(
    `CREATE TABLE IF NOT EXISTS __drizzle_migrations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       hash TEXT NOT NULL,
       created_at NUMERIC
     )`
  );

  const existing = new Set(
    (db.prepare("SELECT hash FROM __drizzle_migrations").all() as { hash: string }[])
      .map((r) => r.hash)
  );

  const journal = loadJournal().sort((a, b) => a.idx - b.idx);
  const insert = db.prepare(
    "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
  );

  let inserted = 0;
  let skipped = 0;
  for (const entry of journal) {
    const sqlPath = path.join(DRIZZLE_DIR, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`! missing ${sqlPath} — skipping ${entry.tag}`);
      continue;
    }
    const sql = fs.readFileSync(sqlPath, "utf8");
    const hash = hashSql(sql);
    if (existing.has(hash)) {
      console.log(`= ${entry.tag} already logged (${hash.slice(0, 12)})`);
      skipped++;
      continue;
    }
    insert.run(hash, entry.when);
    console.log(`+ ${entry.tag} marked applied (${hash.slice(0, 12)})`);
    inserted++;
  }

  console.log(`\ndone. inserted=${inserted} skipped=${skipped} total=${journal.length}`);
  console.log("now safe to run: npm run db:migrate");
}

main();
