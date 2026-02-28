import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { milestoneChecklistItems, milestoneChecklistCompletions, milestoneChecklistCompletionsRelations, milestones, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

const completeChecklistSchema = z.object({
  notes: z.string().optional(),
});

// POST /api/projects/[id]/milestones/[milestoneId]/checklist/[itemId]/complete - Mark item as complete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string; itemId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id, milestoneId, itemId } = await params;
    const projectId = parseInt(id);
    const milestoneIdNum = parseInt(milestoneId);
    const itemIdNum = parseInt(itemId);

    if (isNaN(projectId) || isNaN(milestoneIdNum) || isNaN(itemIdNum)) {
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

    // Verify the checklist item belongs to the correct milestone and project
    const checklistItem = await db.query.milestoneChecklistItems.findFirst({
      where: eq(milestoneChecklistItems.id, itemIdNum),
      with: {
        milestone: true,
      },
    });

    if (!checklistItem || checklistItem.milestone.id !== milestoneIdNum || checklistItem.milestone.projectId !== projectId) {
      return NextResponse.json(
        { error: "Checklist item not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = completeChecklistSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { notes } = validation.data;

    // Check if already completed
    const existingCompletion = await db.query.milestoneChecklistCompletions.findFirst({
      where: eq(milestoneChecklistCompletions.checklistItemId, itemIdNum),
    });

    if (existingCompletion) {
      return NextResponse.json(
        { error: "Item already completed", code: "ALREADY_COMPLETED" },
        { status: 400 }
      );
    }

    // Create completion record
    const [completion] = await db.insert(milestoneChecklistCompletions).values({
      checklistItemId: itemIdNum,
      userId: authUser.id,
      notes: notes || null,
    }).returning();

    // Update milestone status if needed
    const allItems = await db.query.milestoneChecklistItems.findMany({
      where: eq(milestoneChecklistItems.milestoneId, milestoneIdNum),
      with: {
        completions: true,
      },
    });

    const allCompleted = allItems.every((item) => item.completions.length > 0);
    const someCompleted = allItems.some((item) => item.completions.length > 0);

    let newStatus = checklistItem.milestone.status;
    if (allCompleted) {
      newStatus = "Completed";
    } else if (someCompleted && checklistItem.milestone.status === "Not Started") {
      newStatus = "In Progress";
    }

    if (newStatus !== checklistItem.milestone.status) {
      await db.update(milestones)
        .set({ status: newStatus })
        .where(eq(milestones.id, milestoneIdNum));
    }

    return NextResponse.json({ 
      completion: {
        ...completion,
        user: {
          id: authUser.id,
          name: authUser.email, // Will be populated from DB
        },
      },
      milestoneStatus: newStatus,
    });
    
  } catch (error) {
    console.error("Complete checklist item error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/milestones/[milestoneId]/checklist/[itemId]/complete - Unmark item as complete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string; itemId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id, milestoneId, itemId } = await params;
    const projectId = parseInt(id);
    const milestoneIdNum = parseInt(milestoneId);
    const itemIdNum = parseInt(itemId);

    if (isNaN(projectId) || isNaN(milestoneIdNum) || isNaN(itemIdNum)) {
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

    // Verify the checklist item belongs to the correct milestone and project
    const checklistItem = await db.query.milestoneChecklistItems.findFirst({
      where: eq(milestoneChecklistItems.id, itemIdNum),
      with: {
        milestone: true,
      },
    });

    if (!checklistItem || checklistItem.milestone.id !== milestoneIdNum || checklistItem.milestone.projectId !== projectId) {
      return NextResponse.json(
        { error: "Checklist item not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Delete completion record
    await db.delete(milestoneChecklistCompletions)
      .where(eq(milestoneChecklistCompletions.checklistItemId, itemIdNum));

    // Update milestone status if needed
    const allItems = await db.query.milestoneChecklistItems.findMany({
      where: eq(milestoneChecklistItems.milestoneId, milestoneIdNum),
      with: {
        completions: true,
      },
    });

    const someCompleted = allItems.some((item) => item.completions.length > 0);

    let newStatus = checklistItem.milestone.status;
    if (!someCompleted) {
      newStatus = "Not Started";
    } else if (someCompleted && checklistItem.milestone.status === "Completed") {
      newStatus = "In Progress";
    }

    if (newStatus !== checklistItem.milestone.status) {
      await db.update(milestones)
        .set({ status: newStatus })
        .where(eq(milestones.id, milestoneIdNum));
    }

    return NextResponse.json({ 
      success: true,
      milestoneStatus: newStatus,
    });
    
  } catch (error) {
    console.error("Uncomplete checklist item error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
