import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueVerifications, activityLog, issues, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const issueId = parseInt(id);

    if (isNaN(issueId)) {
      return NextResponse.json(
        { error: "Invalid issue ID", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
    });

    if (!issue) {
      return NextResponse.json(
        { error: "Issue not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check project membership - all project members can verify
    const membership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, issue.projectId),
        eq(projectMembers.userId, authUser.id)
      ),
    });

    // Allow if user is global Admin OR is a project member (admin, member, or qa)
    const isAuthorized = authUser.role === "Admin" || membership !== undefined;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Only project members can verify issues", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Toggle isVerified field
    const newIsVerified = !issue.isVerified;

    await db.update(issues)
      .set({ 
        updatedAt: new Date(),
        isVerified: newIsVerified,
      })
      .where(eq(issues.id, issueId));

    // Log activity
    await db.insert(activityLog).values({
      issueId,
      userId: authUser.id,
      action: newIsVerified ? "verified this issue" : "removed verification",
    });

    return NextResponse.json({ isVerified: newIsVerified });
    
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
