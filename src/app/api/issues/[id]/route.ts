import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { issues, projectMembers, activityLog } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_TYPES } from "@/constants";

const updateIssueSchema = z.object({
  title: z.string().min(2).optional(),
  type: z.enum([ISSUE_TYPES.BUG, ISSUE_TYPES.FEATURE]).optional(),
  description: z.string().optional(),
  status: z.enum([
    ISSUE_STATUSES.OPEN,
    ISSUE_STATUSES.IN_PROGRESS,
    ISSUE_STATUSES.IN_REVIEW,
    ISSUE_STATUSES.VERIFIED,
    ISSUE_STATUSES.CLOSED,
  ]).optional(),
  priority: z.enum([
    ISSUE_PRIORITIES.LOW,
    ISSUE_PRIORITIES.MEDIUM,
    ISSUE_PRIORITIES.HIGH,
    ISSUE_PRIORITIES.CRITICAL,
  ]).optional(),
});

// GET /api/issues/[id] - Get issue details
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

    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        project: true,
        reporter: {
          columns: { id: true, name: true, email: true },
        },
        assignees: {
          with: {
            user: { columns: { id: true, name: true, email: true } },
          },
        },
        verifiers: {
          with: {
            user: { columns: { id: true, name: true, email: true } },
          },
        },
        verifications: {
          with: {
            user: { columns: { id: true, name: true, email: true } },
          },
        },
        comments: {
          with: {
            user: { columns: { id: true, name: true, email: true } },
            attachments: true,
          },
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        },
        attachments: true,
        activities: {
          with: {
            user: { columns: { id: true, name: true, email: true } },
          },
          orderBy: (activities, { desc }) => [desc(activities.createdAt)],
        },
      },
    });

    if (!issue) {
      return NextResponse.json(
        { error: "Issue not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if user has access to this issue's project
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

    return NextResponse.json({ issue });
    
  } catch (error) {
    console.error("Get issue error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT /api/issues/[id] - Update issue
export async function PUT(
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
        { error: "Viewers cannot update issues", code: "FORBIDDEN" },
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

    const existingIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
    });

    if (!existingIssue) {
      return NextResponse.json(
        { error: "Issue not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const membership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, existingIssue.projectId),
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
    const validation = updateIssueSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Log activity for status changes
    if (updates.status && updates.status !== existingIssue.status) {
      await db.insert(activityLog).values({
        issueId,
        userId: authUser.id,
        action: "changed status",
        oldValue: existingIssue.status,
        newValue: updates.status,
      });
    }

    // Log activity for priority changes
    if (updates.priority && updates.priority !== existingIssue.priority) {
      await db.insert(activityLog).values({
        issueId,
        userId: authUser.id,
        action: "changed priority",
        oldValue: existingIssue.priority,
        newValue: updates.priority,
      });
    }

    const [updatedIssue] = await db.update(issues)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId))
      .returning();

    return NextResponse.json({ issue: updatedIssue });
    
  } catch (error) {
    console.error("Update issue error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/issues/[id] - Delete issue
export async function DELETE(
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

    if (authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Only admins can delete issues", code: "FORBIDDEN" },
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

    await db.delete(issues).where(eq(issues.id, issueId));

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Delete issue error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
