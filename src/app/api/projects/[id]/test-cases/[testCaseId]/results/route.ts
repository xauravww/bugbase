import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testCaseResults } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, testCaseId: string }> }
) {
  try {
    const resolvedParams = await params;
    const testCaseId = parseInt(resolvedParams.testCaseId);
    const authUser = getAuthUser(request);

    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { status, notes } = body;

    if (!["Pass", "Fail", "Blocked"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const [newResult] = await db.insert(testCaseResults).values({
      testCaseId,
      userId: authUser.id,
      status,
      notes,
    }).returning();

    return NextResponse.json({ result: newResult }, { status: 201 });
  } catch (error) {
    console.error("POST test case result error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
