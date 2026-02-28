import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attachments, issues, activityLog, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const attachmentSchema = z.object({
  url: z.string().url(),
  deleteHash: z.string().optional(),
  commentId: z.number().optional(),
});

// POST /api/issues/[id]/attachments - Add attachment to issue
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
        { error: "You cannot add attachments", code: "FORBIDDEN" },
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

    const body = await request.json();
    const validation = attachmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { url, deleteHash, commentId } = validation.data;

    const [attachment] = await db.insert(attachments).values({
      issueId,
      url,
      imgbbDeleteHash: deleteHash,
      uploadedBy: authUser.id,
      ...(commentId ? { commentId } : {}),
    }).returning();

    await db.insert(activityLog).values({
      issueId,
      userId: authUser.id,
      action: "added an attachment",
    });

    await db.update(issues)
      .set({ updatedAt: new Date() })
      .where(eq(issues.id, issueId));

    return NextResponse.json({ attachment }, { status: 201 });

  } catch (error) {
    console.error("Add attachment error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
