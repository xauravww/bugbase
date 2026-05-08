import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories, projectMembers, projects, issueCategories } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

const updateCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be less than 50 characters").optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
});

// GET /api/categories/[id] - Get a single category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryIdStr } = await params;
    const categoryId = parseInt(categoryIdStr);
    
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Get category error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT /api/categories/[id] - Update a category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryIdStr } = await params;
    const categoryId = parseInt(categoryIdStr);

    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Only Admin and QA can update categories
    if (authUser.role !== "Admin" && authUser.role !== "QA") {
      return NextResponse.json(
        { error: "Only admins and QA can manage categories", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Check if category exists
    const existingCategory = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if user has access to the project
    if (authUser.role !== "Admin") {
      const membership = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, existingCategory.projectId),
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

    const body = await request.json();
    const validation = updateCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, color } = validation.data;

    // Check for duplicate name if name is being updated
    if (name && name !== existingCategory.name) {
      const duplicateCategory = await db.query.categories.findFirst({
        where: and(
          eq(categories.projectId, existingCategory.projectId),
          eq(categories.name, name)
        ),
      });

      if (duplicateCategory) {
        return NextResponse.json(
          { error: "Category with this name already exists", code: "DUPLICATE" },
          { status: 400 }
        );
      }
    }

    const [updatedCategory] = await db.update(categories)
      .set({
        ...(name && { name }),
        ...(color && { color }),
      })
      .where(eq(categories.id, categoryId))
      .returning();

    return NextResponse.json({ category: updatedCategory });
  } catch (error) {
    console.error("Update category error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/[id] - Delete a category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryIdStr } = await params;
    const categoryId = parseInt(categoryIdStr);

    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Only Admin and QA can delete categories
    if (authUser.role !== "Admin" && authUser.role !== "QA") {
      return NextResponse.json(
        { error: "Only admins and QA can manage categories", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Check if category exists
    const existingCategory = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if user has access to the project
    if (authUser.role !== "Admin") {
      const membership = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, existingCategory.projectId),
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

    // Delete the category (cascade will handle issue_categories)
    await db.delete(categories).where(eq(categories.id, categoryId));

    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}