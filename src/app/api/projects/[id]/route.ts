import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { projects, projectMembers, issues } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, inArray, like, or } from "drizzle-orm";

const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  archived: z.boolean().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

// GET /api/projects/[id] - Get project details
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
    const projectId = parseInt(id);
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid pagination parameters", code: "INVALID_PAGINATION" },
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

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

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        members: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
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

    if (!project) {
      return NextResponse.json(
        { error: "Project not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Build where clause with filters
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search") || "";

    let whereClause = eq(issues.projectId, projectId);

    if (search) {
      const cleanSearch = search.replace(/^#/, "").trim();
      const searchAsNumber = parseInt(cleanSearch);
      if (!isNaN(searchAsNumber) && String(searchAsNumber) === cleanSearch) {
        whereClause = and(
          whereClause,
          or(
            eq(issues.id, searchAsNumber),
            like(issues.title, `%${search}%`),
            like(issues.description, `%${search}%`)
          )
        ) as typeof whereClause;
      } else {
        whereClause = and(
          whereClause,
          or(
            like(issues.title, `%${search}%`),
            like(issues.description, `%${search}%`)
          )
        ) as typeof whereClause;
      }
    }

    if (status) {
      const statuses = status.split(",").map(s => s.trim()) as ("Open" | "In Progress" | "In Review" | "Verified" | "Closed")[];
      if (statuses.length === 1) {
        whereClause = and(whereClause, eq(issues.status, statuses[0])) as typeof whereClause;
      } else {
        whereClause = and(whereClause, inArray(issues.status, statuses)) as typeof whereClause;
      }
    }

    if (type) {
      whereClause = and(whereClause, eq(issues.type, type as "Bug" | "Feature")) as typeof whereClause;
    }

    if (priority) {
      whereClause = and(whereClause, eq(issues.priority, priority as "Low" | "Medium" | "High" | "Critical")) as typeof whereClause;
    }

    // Get total count with filters for pagination
    const totalCountResult = await db
      .select({ count: issues.id })
      .from(issues)
      .where(whereClause);
    const total = totalCountResult.length;
    const totalPages = Math.ceil(total / limit);

    // Get paginated project issues with filters
    const projectIssues = await db.query.issues.findMany({
      where: whereClause,
      with: {
        reporter: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignees: {
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
      orderBy: (issues, { desc }) => [desc(issues.updatedAt)],
      limit,
      offset,
    });

    // Get open issue count (unfiltered for overall stats)
    const allIssuesCount = await db
      .select({ count: issues.id })
      .from(issues)
      .where(eq(issues.projectId, projectId));
    const allTotal = allIssuesCount.length;
    const closedCountResult = await db
      .select({ count: issues.id })
      .from(issues)
      .where(and(eq(issues.projectId, projectId), inArray(issues.status, ["Verified", "Closed"])));
    const closedCount = closedCountResult.length;
    const openIssueCount = allTotal - closedCount;

    return NextResponse.json({
      project: {
        ...project,
        issueCount: allTotal,
        openIssueCount,
      },
      issues: projectIssues,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
    
  } catch (error) {
    console.error("Get project error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id] - Update project
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
        { error: "Only project admins can update projects", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateProjectSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { ...validation.data };
    if (validation.data.startDate !== undefined) {
      updates.startDate = validation.data.startDate ? new Date(validation.data.startDate) : null;
    }
    if (validation.data.endDate !== undefined) {
      updates.endDate = validation.data.endDate ? new Date(validation.data.endDate) : null;
    }

    const [updatedProject] = await db.update(projects)
      .set(updates)
      .where(eq(projects.id, projectId))
      .returning();

    return NextResponse.json({ project: updatedProject });
    
  } catch (error) {
    console.error("Update project error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project
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
        { error: "Only admins can delete projects", code: "FORBIDDEN" },
        { status: 403 }
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

    await db.delete(projects).where(eq(projects.id, projectId));

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
