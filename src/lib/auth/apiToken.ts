import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { apiTokens, users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { JWTPayload } from "@/lib/auth/jwt";

// Remote MCP bearer tokens. Format: `mcp_<64 hex>`. We store only the SHA-256
// hash, so a leaked DB never exposes usable tokens. Lookup is O(1) by hash.

const PREFIX = "mcp_";

export function generateToken(): { token: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const token = `${PREFIX}${raw}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 12) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Resolve a raw `mcp_...` token to its owning user (as a JWT payload).
 * Returns null if the token is unknown or revoked. Updates lastUsedAt.
 */
export async function resolveApiToken(rawToken: string): Promise<JWTPayload | null> {
  if (!rawToken || !rawToken.startsWith(PREFIX)) return null;
  const hash = hashToken(rawToken);

  const row = await db.query.apiTokens.findFirst({
    where: and(eq(apiTokens.tokenHash, hash), isNull(apiTokens.revokedAt)),
  });
  if (!row) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, row.userId),
    columns: { id: true, email: true, role: true },
  });
  if (!user) return null;

  // Best-effort last-used stamp (non-blocking failure is fine)
  try {
    db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id)).run();
  } catch {
    /* ignore */
  }

  return { id: user.id, email: user.email, role: user.role };
}
