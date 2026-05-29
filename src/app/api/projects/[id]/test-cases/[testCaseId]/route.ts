import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testCases, testCaseResults, testCaseEmbeddings } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, testCaseId: string }> }
) {
  try {
    const resolvedParams = await params;
    const testCaseId = parseInt(resolvedParams.testCaseId);
    const authUser = getAuthUser(request);

    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    db.transaction((tx) => {
      tx.delete(testCaseResults).where(eq(testCaseResults.testCaseId, testCaseId)).run();
      tx.delete(testCaseEmbeddings).where(eq(testCaseEmbeddings.testCaseId, testCaseId)).run();
      tx.delete(testCases).where(eq(testCases.id, testCaseId)).run();
      return true;
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE test case error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, testCaseId: string }> }
) {
  try {
    const resolvedParams = await params;
    const testCaseId = parseInt(resolvedParams.testCaseId);
    const authUser = getAuthUser(request);

    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { title, description, steps, expectedResult } = body;
    
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    db.transaction((tx) => {
      tx.update(testCases)
        .set({ title, description, steps, expectedResult })
        .where(eq(testCases.id, testCaseId))
        .run();
      return true;
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH test case error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
