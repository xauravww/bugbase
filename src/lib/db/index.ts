import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_PATH || "./bugbase.db");

let vecLoaded = false;
try {
  sqliteVec.load(sqlite);
  vecLoaded = true;
  sqlite.exec("CREATE VIRTUAL TABLE IF NOT EXISTS context_vec USING vec0(entry_id INTEGER PRIMARY KEY, embedding FLOAT[768])");
} catch (e) {
  console.warn("[db] sqlite-vec not loaded:", (e as Error).message);
}

export const db = drizzle(sqlite, { schema });
export const sqliteRaw = sqlite;
export const vecAvailable = () => vecLoaded;

export type DbType = typeof db;
