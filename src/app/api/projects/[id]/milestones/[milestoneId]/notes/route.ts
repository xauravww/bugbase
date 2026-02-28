import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { milestoneNotes, milestones, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

const addNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

// GET /api/projects/[id]/milestones/[milestoneId]/notes - List notes for a milestone
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

    // Verify the milestone belongs to the project
    const milestone = await db.query.milestones.findFirst({
      where: and(
        eq(milestones.id, milestoneIdNum),
        eq(milestones.projectId, projectId)
      ),
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const notes = await db.query.milestoneNotes.findMany({
      where: eq(milestoneNotes.milestoneId, milestoneIdNum),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: desc(milestoneNotes.createdAt),
    });

    return NextResponse.json({ notes });
    
  } catch (error) {
    console.error("Get milestone notes error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/milestones/[milestoneId]/notes - Add a note to a milestone
export async function POST(
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

    // Verify the milestone belongs to the project
    const milestone = await db.query.milestones.findFirst({
      where: and(
        eq(milestones.id, milestoneIdNum),
        eq(milestones.projectId, projectId)
      ),
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = addNoteSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { content } = validation.data;

    const [note] = await db.insert(milestoneNotes).values({
      milestoneId: milestoneIdNum,
      userId: authUser.id,
      content,
    }).returning();

    // Fetch the note with user info
    const noteWithUser = await db.query.milestoneNotes.findFirst({
      where: eq(milestoneNotes.id, note.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ note: noteWithUser }, { status: 201 });
    
  } catch (error) {
    console.error("Add milestone note error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
