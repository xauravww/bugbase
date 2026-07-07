# Bugbase MCP Server

Exposes bugbase (projects, issues, test cases, the task tracker, team progress,
admin settings) to any MCP client — Claude Code, Claude Desktop, Cursor.

Two ways to connect. **Remote is the default** — testers/devs connect to a URL,
nothing to install.

## Remote (recommended)

The app hosts an MCP endpoint at **`<app-url>/api/mcp`** (Streamable HTTP). Auth
is a bearer token you mint in the UI.

1. In bugbase, open **Settings → MCP Server → Generate token**. Copy it (shown once).
2. Add to your MCP client config:

```json
{
  "mcpServers": {
    "bugbase": {
      "url": "https://your-bugbase-domain/api/mcp",
      "headers": { "Authorization": "Bearer mcp_YOUR_TOKEN" }
    }
  }
}
```

3. Reload MCP servers in your client. No login step — the token identifies you.

Every call runs as the token's owner, scoped by their role + project
memberships (enforced by the REST API, one source of truth). Revoke anytime in
Settings.

### Verify remote

```bash
curl -s -X POST https://your-bugbase-domain/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mcp_YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head
```

## Local (stdio) — same machine only

For running Claude directly on the bugbase host. Uses a `login` tool instead of
a token.

```json
{
  "mcpServers": {
    "bugbase": {
      "command": "npx",
      "args": ["-y", "tsx", "/absolute/path/to/bugbase/mcp/server.ts"],
      "env": { "BUGBASE_URL": "http://localhost:3050" }
    }
  }
}
```

URL resolution: `BUGBASE_URL`, else `http://localhost:$PORT`, else
`http://localhost:3000`. Call `login(email, password)` first; the JWT is cached
for the session. `tsx` is a dev dependency — if you deployed with
`--production`, run a full `npm install` or `npm i -g tsx`.

## Architecture

Both transports share one tool registry (`src/lib/mcp/tools.ts`). Every tool
calls the bugbase REST API — the remote route mints a short-lived JWT from the
bearer token; the stdio server uses the JWT from `login`. Permission logic lives
only in the API.
