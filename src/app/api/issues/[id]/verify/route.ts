import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueVerifications, issueVerifiers, activityLog, issues, projectMembers } from "@/lib/db/schema";
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

    if (authUser.role === "Viewer") {
      return NextResponse.json(
        { error: "You cannot verify issues", code: "FORBIDDEN" },
        { status: 403 }
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

    const membership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, issue.projectId),
        eq(projectMembers.userId, authUser.id)
      ),
    });

    if (!membership && authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Not a member of this project", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const existingVerification = await db.query.issueVerifications.findFirst({
      where: and(
        eq(issueVerifications.issueId, issueId),
        eq(issueVerifications.userId, authUser.id)
      ),
    });

    if (existingVerification) {
      await db.delete(issueVerifications).where(
        eq(issueVerifications.id, existingVerification.id)
      );

      await db.insert(activityLog).values({
        issueId,
        userId: authUser.id,
        action: "removed verification",
      });

      // Check if there are any remaining verifications
      const remainingVerifications = await db.query.issueVerifications.findMany({
        where: eq(issueVerifications.issueId, issueId),
      });

      // If no verifications remain, revert status to "In Review"
      if (remainingVerifications.length === 0) {
        await db.update(issues)
          .set({ 
            updatedAt: new Date(),
            status: "In Review",
          })
          .where(eq(issues.id, issueId));
      }

      return NextResponse.json({ verified: false });
    }

    await db.insert(issueVerifications).values({
      issueId,
      userId: authUser.id,
    });

    await db.insert(activityLog).values({
      issueId,
      userId: authUser.id,
      action: "verified this issue",
    });

    await db.update(issues)
      .set({ 
        updatedAt: new Date(),
        status: "Verified",
      })
      .where(eq(issues.id, issueId));

    return NextResponse.json({ verified: true });
    
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
