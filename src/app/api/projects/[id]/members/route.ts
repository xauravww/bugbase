import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { projectMembers, users } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

const addMemberSchema = z.object({
  userId: z.number(),
  role: z.enum(["admin", "member", "qa"]).optional().default("member"),
});

// POST /api/projects/[id]/members - Add member to project
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
    const projectId = parseInt(id);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    // Check if user is project admin
    const membership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, authUser.id)
      ),
    });

    if ((!membership || membership.role !== "admin") && authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Only project admins can add members", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = addMemberSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { userId, role } = validation.data;

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if already a member
    const existingMembership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      ),
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "User is already a member", code: "ALREADY_MEMBER" },
        { status: 400 }
      );
    }

    const [newMember] = await db.insert(projectMembers).values({
      projectId,
      userId,
      role,
    }).returning();

    return NextResponse.json({ member: newMember }, { status: 201 });
    
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/members?userId=X - Remove member from project
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

    const { id } = await params;
    const projectId = parseInt(id);
    const userId = parseInt(request.nextUrl.searchParams.get("userId") || "");

    if (isNaN(projectId) || isNaN(userId)) {
      return NextResponse.json(
        { error: "Invalid project or user ID", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    // Check if user is project admin
    const membership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, authUser.id)
      ),
    });

    if ((!membership || membership.role !== "admin") && authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Only project admins can remove members", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    await db.delete(projectMembers).where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    );

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
