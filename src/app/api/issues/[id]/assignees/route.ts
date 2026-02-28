import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueAssignees, activityLog, issues, users, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const assigneesSchema = z.object({
  userIds: z.array(z.number()),
});

// POST /api/issues/[id]/assignees - Update assignees
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
        { error: "You cannot assign issues", code: "FORBIDDEN" },
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

    // Check project membership
    const membership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, issue.projectId),
        eq(projectMembers.userId, authUser.id)
      ),
    });

    // Only project members can assign issues
    if (!membership && authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Only project members can assign issues", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = assigneesSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { userIds } = validation.data;

    // Get current assignees
    const currentAssignees = await db.query.issueAssignees.findMany({
      where: eq(issueAssignees.issueId, issueId),
      with: {
        user: { columns: { id: true, name: true } },
      },
    });

    const currentIds = currentAssignees.map(a => a.userId);
    const addedIds = userIds.filter(id => !currentIds.includes(id));
    const removedIds = currentIds.filter(id => !userIds.includes(id));

    // Remove old assignees
    if (removedIds.length > 0) {
      for (const userId of removedIds) {
        await db.delete(issueAssignees).where(
          and(
            eq(issueAssignees.issueId, issueId),
            eq(issueAssignees.userId, userId)
          )
        );
      }
    }

    // Add new assignees - must be existing project members
    if (addedIds.length > 0) {
      // Verify all users are project members
      const projectMemberRecords = await db.query.projectMembers.findMany({
        where: and(
          eq(projectMembers.projectId, issue.projectId),
          inArray(projectMembers.userId, addedIds)
        ),
      });

      const validMemberIds = projectMemberRecords.map(m => m.userId);
      const invalidIds = addedIds.filter(id => !validMemberIds.includes(id));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: "Only project members can be assigned to issues", code: "INVALID_ASSIGNEE" },
          { status: 400 }
        );
      }

      await db.insert(issueAssignees).values(
        validMemberIds.map(userId => ({
          issueId,
          userId,
        }))
      );
    }

    // Log activity
    if (addedIds.length > 0 || removedIds.length > 0) {
      const addedUsers = await Promise.all(
        addedIds.map(async (id) => {
          const user = await db.query.users.findFirst({ where: eq(users.id, id) });
          return user?.name;
        })
      );

      const removedUsers = currentAssignees
        .filter(a => removedIds.includes(a.userId))
        .map(a => a.user.name);

      let action = "updated assignees";
      if (addedIds.length > 0 && removedIds.length === 0) {
        action = `assigned ${addedUsers.join(", ")}`;
      } else if (removedIds.length > 0 && addedIds.length === 0) {
        action = `unassigned ${removedUsers.join(", ")}`;
      }

      await db.insert(activityLog).values({
        issueId,
        userId: authUser.id,
        action,
      });
    }

    // Update issue's updatedAt
    await db.update(issues)
      .set({ updatedAt: new Date() })
      .where(eq(issues.id, issueId));

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Update assignees error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
