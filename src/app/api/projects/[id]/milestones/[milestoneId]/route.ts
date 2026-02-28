import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { milestones, milestoneChecklistItems, milestoneNotes, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, asc } from "drizzle-orm";

const updateMilestoneSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["Not Started", "In Progress", "Completed"]).optional(),
});

// GET /api/projects/[id]/milestones/[milestoneId] - Get milestone details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id, milestoneId } = await params;
    const projectId = parseInt(id);
    const milestoneIdNum = parseInt(milestoneId);

    if (isNaN(projectId) || isNaN(milestoneIdNum)) {
      return NextResponse.json(
        { error: "Invalid ID", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    // Check if user is a member
    const membership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, authUser.id)
      ),
    });

    if (!membership && authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Not a member of this project", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const milestone = await db.query.milestones.findFirst({
      where: and(
        eq(milestones.id, milestoneIdNum),
        eq(milestones.projectId, projectId)
      ),
      with: {
        checklistItems: {
          with: {
            completions: {
              with: {
                user: {
                  columns: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: asc(milestoneChecklistItems.order),
        },
        notes: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: (milestoneNotes, { desc }) => [desc(milestoneNotes.createdAt)],
        },
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const totalCount = milestone.checklistItems.length;
    const completedCount = milestone.checklistItems.filter(
      (item) => item.completions.length > 0
    ).length;

    return NextResponse.json({
      milestone: {
        ...milestone,
        checklistItems: milestone.checklistItems.map((item) => ({
          ...item,
          completion: item.completions[0] || null,
        })),
        totalCount,
        completedCount,
      },
    });
    
  } catch (error) {
    console.error("Get milestone error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/milestones/[milestoneId] - Update milestone (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Only admins can update milestones
    if (authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Only admins can update milestones", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { id, milestoneId } = await params;
    const projectId = parseInt(id);
    const milestoneIdNum = parseInt(milestoneId);

    if (isNaN(projectId) || isNaN(milestoneIdNum)) {
      return NextResponse.json(
        { error: "Invalid ID", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateMilestoneSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { ...validation.data };

    const [updatedMilestone] = await db.update(milestones)
      .set(updates)
      .where(and(
        eq(milestones.id, milestoneIdNum),
        eq(milestones.projectId, projectId)
      ))
      .returning();

    if (!updatedMilestone) {
      return NextResponse.json(
        { error: "Milestone not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ milestone: updatedMilestone });
    
  } catch (error) {
    console.error("Update milestone error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/milestones/[milestoneId] - Delete milestone (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Only admins can delete milestones
    if (authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Only admins can delete milestones", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { id, milestoneId } = await params;
    const projectId = parseInt(id);
    const milestoneIdNum = parseInt(milestoneId);

    if (isNaN(projectId) || isNaN(milestoneIdNum)) {
      return NextResponse.json(
        { error: "Invalid ID", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    await db.delete(milestones)
      .where(and(
        eq(milestones.id, milestoneIdNum),
        eq(milestones.projectId, projectId)
      ));

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Delete milestone error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
