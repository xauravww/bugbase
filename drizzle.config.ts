import type { Config } from "drizzle-kit";

export default {
  schema: ["./src/lib/db/schema.ts", "./src/lib/db/pm-schema.ts"],
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./bugbase.db",
  },
} satisfies Config;
