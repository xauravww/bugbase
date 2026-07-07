import { NextRequest, NextResponse } from "next/server";
import { resolveApiToken } from "@/lib/auth/apiToken";
import { signToken } from "@/lib/auth/jwt";
import { TOOLS, TOOLS_BY_NAME, type ToolContext } from "@/lib/mcp/tools";

// Remote MCP endpoint (Streamable HTTP, stateless JSON-RPC).
//
// Clients connect with a URL + `Authorization: Bearer mcp_...` header. The token
// resolves to a bugbase user; every tool call self-fetches the REST API with a
// short-lived JWT minted for that user, so all role + membership checks apply.

const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

function result(id: JsonRpcId, res: unknown) {
  return { jsonrpc: "2.0" as const, id, result: res };
}
function error(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

// Build a ToolContext whose `call` hits this same app's REST API with a minted JWT.
function makeContext(origin: string, jwt: string): ToolContext {
  return {
    call: async (method, path, body) => {
      const res = await fetch(`${origin}${path}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
  };
}

async function handleRpc(req: JsonRpcRequest, origin: string, jwt: string) {
  const { id = null, method, params } = req;

  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "bugbase", version: "2.0.0" },
      });

    case "notifications/initialized":
      return null; // notification: no response

    case "ping":
      return result(id, {});

    case "tools/list":
      return result(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const name = params?.name as string;
      const args = (params?.arguments as Record<string, unknown>) || {};
      const tool = TOOLS_BY_NAME[name];
      if (!tool) return error(id, -32602, `Unknown tool: ${name}`);
      try {
        const out = await tool.handler(args, makeContext(origin, jwt));
        return result(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return result(id, {
          content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
          isError: true,
        });
      }
    }

    default:
      return error(id, -32601, `Method not found: ${method}`);
  }
}

export async function POST(request: NextRequest) {
  // Authenticate the bearer MCP token.
  const authHeader = request.headers.get("authorization");
  const raw = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const user = raw ? await resolveApiToken(raw) : null;
  if (!user) {
    return NextResponse.json(error(null, -32001, "Unauthorized: provide a valid Bearer mcp_ token"), { status: 401 });
  }

  // Mint a short-lived JWT so downstream API calls carry the user's identity.
  const jwt = signToken({ id: user.id, email: user.email, role: user.role });
  const origin = request.nextUrl.origin;

  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(error(null, -32700, "Parse error"), { status: 400 });
  }

  // Support single or batched requests.
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((r) => handleRpc(r, origin, jwt)))).filter(Boolean);
    return NextResponse.json(responses);
  }

  const res = await handleRpc(body, origin, jwt);
  if (res === null) return new NextResponse(null, { status: 202 }); // notification
  return NextResponse.json(res);
}

// Some clients probe with GET; advertise that POST is the transport.
export async function GET() {
  return NextResponse.json(
    { name: "bugbase", transport: "streamable-http", methods: ["POST"], protocolVersion: PROTOCOL_VERSION },
    { status: 200 }
  );
}
