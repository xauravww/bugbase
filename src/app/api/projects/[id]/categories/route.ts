import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories, projectMembers, projects } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be less than 50 characters"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#5b76fe"),
});

// GET /api/projects/[id]/categories - List all categories for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr);
    
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check membership (admin can access any project)
    if (authUser.role !== "Admin") {
      const membership = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, authUser.id)
        ),
      });

      if (!membership) {
        return NextResponse.json(
          { error: "Access denied", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    const projectCategories = await db.query.categories.findMany({
      where: eq(categories.projectId, projectId),
      orderBy: (categories, { asc }) => [asc(categories.name)],
    });

    return NextResponse.json({ categories: projectCategories });
  } catch (error) {
    console.error("Get categories error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/categories - Create a new category
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr);

    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Only Admin and QA can create categories
    if (authUser.role !== "Admin" && authUser.role !== "QA") {
      return NextResponse.json(
        { error: "Only admins and QA can manage categories", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Check if project exists
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if user is a member of the project
    if (authUser.role !== "Admin") {
      const membership = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, authUser.id)
        ),
      });

      if (!membership) {
        return NextResponse.json(
          { error: "Not a member of this project", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validation = createCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, color } = validation.data;

    // Check for duplicate name in the project
    const existingCategory = await db.query.categories.findFirst({
      where: and(
        eq(categories.projectId, projectId),
        eq(categories.name, name)
      ),
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "Category with this name already exists", code: "DUPLICATE" },
        { status: 400 }
      );
    }

    const [newCategory] = await db.insert(categories).values({
      projectId,
      name,
      color,
      createdBy: authUser.id,
    }).returning();

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (error) {
    console.error("Create category error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/categories/seed - Seed default categories (for new projects or manual reset)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr);

    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Only Admin and QA can seed categories
    if (authUser.role !== "Admin" && authUser.role !== "QA") {
      return NextResponse.json(
        { error: "Only admins and QA can manage categories", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Check if project exists
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if user is a member of the project
    if (authUser.role !== "Admin") {
      const membership = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, authUser.id)
        ),
      });

      if (!membership) {
        return NextResponse.json(
          { error: "Not a member of this project", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    // Check if categories already exist
    const existingCategories = await db.query.categories.findMany({
      where: eq(categories.projectId, projectId),
    });

    if (existingCategories.length > 0) {
      return NextResponse.json(
        { error: "Categories already exist for this project. Delete them first or add manually.", code: "ALREADY_EXISTS" },
        { status: 400 }
      );
    }

    // Insert default categories
    const newCategories = await db.insert(categories).values(
      DEFAULT_CATEGORIES.map((cat) => ({
        projectId,
        name: cat.name,
        color: cat.color,
        createdBy: authUser.id,
      }))
    ).returning();

    return NextResponse.json(
      { 
        message: "Default categories created successfully", 
        categories: newCategories 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Seed categories error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}