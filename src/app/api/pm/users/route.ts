import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { asc } from "drizzle-orm";

// GET /api/pm/users — lightweight id+name list for assignee / participant
// pickers. Available to any authenticated user (unlike the Admin-only
// /api/users), since every module needs to resolve user references.
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const rows = await db.query.users.findMany({
    columns: { id: true, name: true, email: true, role: true },
    orderBy: asc(users.name),
  });
  return NextResponse.json({ users: rows });
}
