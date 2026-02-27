import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { issues, issueAssignees, issueVerifiers, projectMembers, activityLog } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, desc, and, inArray, like, or } from "drizzle-orm";
import { ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_TYPES } from "@/constants";

const createIssueSchema = z.object({
  projectId: z.number(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  type: z.enum([ISSUE_TYPES.BUG, ISSUE_TYPES.FEATURE]).default(ISSUE_TYPES.BUG),
  description: z.string().optional(),
  stepsToReproduce: z.string().optional(),
  expectedResult: z.string().optional(),
  actualResult: z.string().optional(),
  priority: z.enum([ISSUE_PRIORITIES.LOW, ISSUE_PRIORITIES.MEDIUM, ISSUE_PRIORITIES.HIGH, ISSUE_PRIORITIES.CRITICAL]).default(ISSUE_PRIORITIES.MEDIUM),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  assigneeIds: z.array(z.number()).optional(),
  verifierIds: z.array(z.number()).optional(),
});

// GET /api/issues - List issues with search, filters, and pagination
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
    const projectId = searchParams.get("projectId");
    const assignedToMe = searchParams.get("assignedToMe") === "true";
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Get user's projects
    const userMemberships = await db.query.projectMembers.findMany({
      where: eq(projectMembers.userId, authUser.id),
    });
    const projectIds = userMemberships.map(m => m.projectId);

    if (projectIds.length === 0) {
      return NextResponse.json({ issues: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    // Get assigned issues if needed
    let assignedIssueIds: number[] = [];
    if (assignedToMe) {
      const assignments = await db.query.issueAssignees.findMany({
        where: eq(issueAssignees.userId, authUser.id),
      });
      assignedIssueIds = assignments.map(a => a.issueId);
    }

    // Build where clause
    let whereClause = inArray(issues.projectId, projectIds);

    if (assignedToMe && assignedIssueIds.length > 0) {
      whereClause = and(whereClause, inArray(issues.id, assignedIssueIds)) as typeof whereClause;
    }

    if (projectId) {
      whereClause = and(whereClause, eq(issues.projectId, parseInt(projectId))) as typeof whereClause;
    }

    if (search) {
      whereClause = and(
        whereClause,
        or(
          like(issues.title, `%${search}%`),
          like(issues.description, `%${search}%`)
        )
      ) as typeof whereClause;
    }

    if (type) {
      whereClause = and(whereClause, eq(issues.type, type as "Bug" | "Feature")) as typeof whereClause;
    }

    if (status) {
      whereClause = and(whereClause, eq(issues.status, status as "Open" | "In Progress" | "In Review" | "Verified" | "Closed")) as typeof whereClause;
    }

    if (priority) {
      whereClause = and(whereClause, eq(issues.priority, priority as "Low" | "Medium" | "High" | "Critical")) as typeof whereClause;
    }

    const issueList = await db.query.issues.findMany({
      where: whereClause,
      with: {
        project: true,
        reporter: { columns: { id: true, name: true, email: true } },
        assignees: { with: { user: { columns: { id: true, name: true, email: true } } } },
      },
      orderBy: desc(issues.updatedAt),
      limit,
      offset,
    });

    const countResult = await db.select({ id: issues.id }).from(issues).where(whereClause);
    const total = countResult.length;

    return NextResponse.json({ 
      issues: issueList,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
    
  } catch (error) {
    console.error("Get issues error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/issues - Create new issue
export async function POST(request: NextRequest) {
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
        { error: "Viewers cannot create issues", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createIssueSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { projectId, title, type, description, stepsToReproduce, expectedResult, actualResult, priority, startDate, dueDate, assigneeIds, verifierIds } = validation.data;

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

    const [newIssue] = await db.insert(issues).values({
      projectId,
      title,
      type,
      description,
      stepsToReproduce,
      expectedResult,
      actualResult,
      priority,
      status: ISSUE_STATUSES.OPEN,
      reporterId: authUser.id,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
    }).returning();

    if (assigneeIds && assigneeIds.length > 0) {
      await db.insert(issueAssignees).values(
        assigneeIds.map(userId => ({ issueId: newIssue.id, userId }))
      );
    }

    if (verifierIds && verifierIds.length > 0) {
      await db.insert(issueVerifiers).values(
        verifierIds.map(userId => ({ issueId: newIssue.id, userId }))
      );
    }

    await db.insert(activityLog).values({
      issueId: newIssue.id,
      userId: authUser.id,
      action: "created issue",
    });

    return NextResponse.json({ issue: newIssue }, { status: 201 });
    
  } catch (error) {
    console.error("Create issue error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
