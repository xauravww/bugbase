import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testCaseResults } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, testCaseId: string, resultId: string }> }
) {
  try {
    const resolvedParams = await params;
    const resultId = parseInt(resolvedParams.resultId);
    const authUser = getAuthUser(request);

    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { status, notes } = await request.json();
    
    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    await db.update(testCaseResults)
      .set({ status, notes: notes || null })
      .where(eq(testCaseResults.id, resultId))
      .run();
      
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH result error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, testCaseId: string, resultId: string }> }
) {
  try {
    const resolvedParams = await params;
    const resultId = parseInt(resolvedParams.resultId);
    const authUser = getAuthUser(request);

    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db.delete(testCaseResults)
      .where(eq(testCaseResults.id, resultId))
      .run();
      
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE result error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
