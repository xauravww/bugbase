import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { projects, projectMembers, issues } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, desc, inArray, like, or, and } from "drizzle-orm";

const createProjectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  key: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/, "Key must be uppercase letters and numbers only"),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// GET /api/projects - List user's projects with search and pagination
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    const showArchived = searchParams.get("archived") === "true";

    // Get projects where user is a member
    const userMemberships = await db.query.projectMembers.findMany({
      where: eq(projectMembers.userId, authUser.id),
    });

    const projectIds = userMemberships.map(m => m.projectId);

    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    // Build where clause
    let whereClause = inArray(projects.id, projectIds);
    if (search) {
      whereClause = and(
        inArray(projects.id, projectIds),
        or(
          like(projects.name, `%${search}%`),
          like(projects.key, `%${search}%`)
        )
      ) as typeof whereClause;
    }
    if (!showArchived) {
      whereClause = and(whereClause, eq(projects.archived, false)) as typeof whereClause;
    }

    const userProjects = await db.query.projects.findMany({
      where: whereClause,
      with: {
        members: {
          with: {
            user: { columns: { id: true, name: true, email: true, role: true } },
          },
        },
        creator: { columns: { id: true, name: true, email: true } },
      },
      orderBy: desc(projects.createdAt),
      limit,
      offset,
    });

    // Get counts
    const countResult = await db.select({ id: projects.id }).from(projects).where(whereClause);
    const total = countResult.length;

    // Get issue counts for each project
    const projectsWithCounts = await Promise.all(
      userProjects.map(async (project) => {
        const projectIssues = await db.query.issues.findMany({
          where: eq(issues.projectId, project.id),
        });
        
        return {
          ...project,
          issueCount: projectIssues.length,
          openIssueCount: projectIssues.filter(i => i.status !== "Closed").length,
        };
      })
    );

    return NextResponse.json({ 
      projects: projectsWithCounts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
    
  } catch (error) {
    console.error("Get projects error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
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
        { error: "Only admins can create projects", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createProjectSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, key, description, startDate, endDate } = validation.data;

    const existingProject = await db.query.projects.findFirst({
      where: eq(projects.key, key),
    });

    if (existingProject) {
      return NextResponse.json(
        { error: "Project key already exists", code: "KEY_EXISTS" },
        { status: 400 }
      );
    }

    const [newProject] = await db.insert(projects).values({
      name,
      key,
      description,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdBy: authUser.id,
    }).returning();

    await db.insert(projectMembers).values({
      projectId: newProject.id,
      userId: authUser.id,
      role: "admin",
    });

    return NextResponse.json({ project: newProject }, { status: 201 });
    
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
