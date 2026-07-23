import Database from "better-sqlite3";
import fs from "fs";

const db = new Database(process.env.DATABASE_PATH || "./bugbase.db");

const files = ["./drizzle/0007_pm_workspace.sql", "./drizzle/0008_new_pm_modules.sql"];
for (const file of files) {
  const sql = fs.readFileSync(file, "utf8");
  const stmts = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  const tx = db.transaction(() => {
    for (const s of stmts) {
      try {
        db.exec(s);
      } catch (e) {
        if (!/already exists/.test(e.message)) throw e;
      }
    }
  });
  tx();
}

const want = [
  "requirements", "features", "dev_tasks", "bugs", "releases", "api_docs",
  "arch_docs", "meeting_notes", "risks", "ideas", "milestones", "sprints",
  "clients", "release_features", "release_bugs", "dev_task_deps", "pm_activity",
  "user_stories", "personas", "user_journeys", "tech_stack", "mockups", "workflows", "business_rules",
];
const rows = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${want.map(() => "?").join(",")}) ORDER BY name`)
  .all(...want);
console.log("created tables:", rows.map((r) => r.name).join(", "));
console.log("count:", rows.length, "/", want.length);
db.close();
