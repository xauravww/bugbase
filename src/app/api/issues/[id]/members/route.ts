import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectMembers, users, issues } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

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
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";

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

    // Get all users in the system (with optional search)
    let allUsers = await db.select().from(users);

    // Get current project members
    const projectMembersList = await db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, issue.projectId),
    });
    const memberUserIds = new Set(projectMembersList.map(pm => pm.userId));

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      allUsers = allUsers.filter(u => 
        u.name.toLowerCase().includes(searchLower) || 
        u.email.toLowerCase().includes(searchLower)
      );
    }

    // Map users with their project membership status
    const result = allUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isMember: memberUserIds.has(u.id),
    }));

    return NextResponse.json({ members: result });
    
  } catch (error) {
    console.error("Get members error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
