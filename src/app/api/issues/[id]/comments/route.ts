import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { comments, activityLog, issues, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

const createCommentSchema = z.object({
  body: z.string(),
});

// GET /api/issues/[id]/comments - Get comments for an issue
export async function GET(
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

    const issueComments = await db.query.comments.findMany({
      where: eq(comments.issueId, issueId),
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
        attachments: true,
      },
      orderBy: (comments, { asc }) => [asc(comments.createdAt)],
    });

    return NextResponse.json({ comments: issueComments });

  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/issues/[id]/comments - Add comment to an issue
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
        { error: "Viewers cannot comment", code: "FORBIDDEN" },
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

    // Check if issue exists
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
    });

    if (!issue) {
      return NextResponse.json(
        { error: "Issue not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if user has access
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
    const validation = createCommentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const [newComment] = await db.insert(comments).values({
      issueId,
      userId: authUser.id,
      body: validation.data.body,
    }).returning();

    // Log activity
    await db.insert(activityLog).values({
      issueId,
      userId: authUser.id,
      action: "added a comment",
    });

    // Update issue's updatedAt
    await db.update(issues)
      .set({ updatedAt: new Date() })
      .where(eq(issues.id, issueId));

    // Fetch the comment with user info
    const commentWithUser = await db.query.comments.findFirst({
      where: eq(comments.id, newComment.id),
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
        attachments: true,
      },
    });

    return NextResponse.json({ comment: commentWithUser }, { status: 201 });

  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
