import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { generateToken } from "@/lib/auth/apiToken";
import { eq, and, desc, isNull } from "drizzle-orm";

// GET — list the caller's MCP tokens (metadata only; never the raw token).
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await db.query.apiTokens.findMany({
    where: and(eq(apiTokens.userId, authUser.id), isNull(apiTokens.revokedAt)),
    orderBy: desc(apiTokens.createdAt),
    columns: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });
  return NextResponse.json({ tokens });
}

// POST — create a new token. Returns the raw token exactly once.
export async function POST(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await request.json().catch(() => ({ name: "" }));
  const label = (name && String(name).trim()) || "MCP token";

  const { token, hash, prefix } = generateToken();
  const [row] = db.insert(apiTokens).values({
    userId: authUser.id,
    name: label,
    tokenHash: hash,
    prefix,
  }).returning().all();

  return NextResponse.json({
    token, // shown once — the client must copy it now
    id: row.id,
    name: row.name,
    prefix: row.prefix,
  }, { status: 201 });
}
