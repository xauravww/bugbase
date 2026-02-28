import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { milestones, milestoneChecklistItems, milestoneNotes, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, desc, sql } from "drizzle-orm";

const createMilestoneSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  checklistItems: z.array(z.string().min(1)).min(1, "At least one checklist item is required"),
});

// GET /api/projects/[id]/milestones - List all milestones for a project
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

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    
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

    // Get total count
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(milestones)
      .where(eq(milestones.projectId, projectId));
    
    const total = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Get paginated milestones for the project with checklist items and completions
    const projectMilestones = await db.query.milestones.findMany({
      where: eq(milestones.projectId, projectId),
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
          orderBy: (milestoneChecklistItems, { asc }) => [asc(milestoneChecklistItems.order)],
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
          orderBy: desc(milestoneNotes.createdAt),
        },
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: desc(milestones.createdAt),
      limit,
      offset,
    });

    // Transform the data to include completion status
    const milestonesWithProgress = projectMilestones.map((milestone) => {
      const totalCount = milestone.checklistItems.length;
      const completedCount = milestone.checklistItems.filter(
        (item) => item.completions.length > 0
      ).length;

      return {
        ...milestone,
        checklistItems: milestone.checklistItems.map((item) => ({
          ...item,
          completion: item.completions[0] || null,
        })),
        totalCount,
        completedCount,
      };
    });

    return NextResponse.json({ 
      milestones: milestonesWithProgress,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    });
    
  } catch (error) {
    console.error("Get milestones error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/milestones - Create a new milestone (Admin only)
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

    // Only admins can create milestones
    if (authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Only admins can create milestones", code: "FORBIDDEN" },
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

    const body = await request.json();
    const validation = createMilestoneSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { title, description, checklistItems: items } = validation.data;

    // Create milestone
    const [newMilestone] = await db.insert(milestones).values({
      projectId,
      title,
      description,
      createdBy: authUser.id,
    }).returning();

    // Create checklist items
    if (items.length > 0) {
      await db.insert(milestoneChecklistItems).values(
        items.map((content, index) => ({
          milestoneId: newMilestone.id,
          content,
          order: index,
        }))
      );
    }

    // Fetch the complete milestone with checklist items
    const milestoneWithItems = await db.query.milestones.findFirst({
      where: eq(milestones.id, newMilestone.id),
      with: {
        checklistItems: {
          orderBy: (milestoneChecklistItems, { asc }) => [asc(milestoneChecklistItems.order)],
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
          orderBy: desc(milestoneNotes.createdAt),
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

    return NextResponse.json({ 
      milestone: {
        ...milestoneWithItems,
        totalCount: items.length,
        completedCount: 0,
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error("Create milestone error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
