import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TOOLS, type ToolContext } from "../src/lib/mcp/tools.js";

// Local stdio MCP server. Prefer the REMOTE server at `<app>/api/mcp` with a
// bearer token for anything off-box — this is only for running Claude on the
// same machine as bugbase. Auth here uses a `login` tool that caches a JWT.
//
// Both transports share the tool registry in src/lib/mcp/tools.ts.

const BUGBASE_URL =
  process.env.BUGBASE_URL ||
  (process.env.PORT ? `http://localhost:${process.env.PORT}` : "http://localhost:3000");

let cachedToken: string | null = null;

const ctx: ToolContext = {
  call: async (method, path, body) => {
    if (!cachedToken) throw new Error("Not logged in. Call the `login` tool first.");
    const res = await fetch(`${BUGBASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cachedToken}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
    try { return JSON.parse(text); } catch { return text; }
  },
};

const server = new McpServer({ name: "bugbase", version: "2.0.0" });

// Minimal JSON-Schema → zod shape converter for our tool arg schemas.
function toZodShape(schema: { properties: Record<string, unknown>; required?: string[] }) {
  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(schema.required || []);
  for (const [key, def] of Object.entries(schema.properties)) {
    const t = (def as { type?: string; items?: { type?: string } }).type;
    let zt: z.ZodTypeAny;
    if (t === "number") zt = z.number();
    else if (t === "boolean") zt = z.boolean();
    else if (t === "array") zt = z.array(z.number());
    else zt = z.string();
    shape[key] = required.has(key) ? zt : zt.optional();
  }
  return shape;
}

// login is stdio-only (remote uses a bearer token instead).
server.tool(
  "login",
  "Login to bugbase and cache the JWT. All other tools then act as this user.",
  { email: z.string(), password: z.string() },
  async ({ email, password }) => {
    const res = await fetch(`${BUGBASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { content: [{ type: "text" as const, text: `Login failed: ${await res.text()}` }] };
    const data = (await res.json()) as { token: string; user: { name: string; email: string; role: string } };
    cachedToken = data.token;
    return { content: [{ type: "text" as const, text: `Logged in as ${data.user?.name} (${data.user?.email}), role=${data.user?.role}.` }] };
  }
);

// Register every shared tool.
for (const tool of TOOLS) {
  server.tool(tool.name, tool.description, toZodShape(tool.inputSchema), async (args: Record<string, unknown>) => {
    try {
      const out = await tool.handler(args, ctx);
      return { content: [{ type: "text" as const, text: JSON.stringify(out, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  });
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
