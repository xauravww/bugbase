import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueCategories, activityLog, issues, categories, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const categoriesSchema = z.object({
  categoryIds: z.array(z.number()),
});

// POST /api/issues/[id]/categories - Update categories for an issue
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

    if (authUser.role === "Viewer") {
      return NextResponse.json(
        { error: "You cannot edit issue categories", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const issueId = parseInt(id);

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
        { error: "Only project members can edit categories", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = categoriesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { categoryIds } = validation.data;

    if (categoryIds.length > 0) {
      const validCategories = await db.query.categories.findMany({
        where: and(
          eq(categories.projectId, issue.projectId),
          inArray(categories.id, categoryIds)
        ),
        columns: { id: true, name: true },
      });

      if (validCategories.length !== categoryIds.length) {
        return NextResponse.json(
          { error: "One or more categories do not belong to this project", code: "INVALID_CATEGORY" },
          { status: 400 }
        );
      }
    }

    const currentRows = await db.query.issueCategories.findMany({
      where: eq(issueCategories.issueId, issueId),
      with: { category: { columns: { id: true, name: true } } },
    });
    const currentIds = currentRows.map((r) => r.categoryId);
    const addedIds = categoryIds.filter((id) => !currentIds.includes(id));
    const removedIds = currentIds.filter((id) => !categoryIds.includes(id));

    if (removedIds.length > 0) {
      await db.delete(issueCategories).where(
        and(
          eq(issueCategories.issueId, issueId),
          inArray(issueCategories.categoryId, removedIds)
        )
      );
    }

    if (addedIds.length > 0) {
      await db.insert(issueCategories).values(
        addedIds.map((categoryId) => ({ issueId, categoryId }))
      );
    }

    if (addedIds.length > 0 || removedIds.length > 0) {
      const nameById = new Map(currentRows.map((r) => [r.categoryId, r.category.name]));
      const addedCats = await db.query.categories.findMany({
        where: inArray(categories.id, addedIds.length > 0 ? addedIds : [-1]),
        columns: { id: true, name: true },
      });
      addedCats.forEach((c) => nameById.set(c.id, c.name));

      const addedNames = addedIds.map((id) => nameById.get(id)).filter(Boolean) as string[];
      const removedNames = removedIds.map((id) => nameById.get(id)).filter(Boolean) as string[];

      let action = "updated categories";
      if (addedIds.length > 0 && removedIds.length === 0) {
        action = `added categories: ${addedNames.join(", ")}`;
      } else if (removedIds.length > 0 && addedIds.length === 0) {
        action = `removed categories: ${removedNames.join(", ")}`;
      }

      await db.insert(activityLog).values({
        issueId,
        userId: authUser.id,
        action,
      });
    }

    await db.update(issues)
      .set({ updatedAt: new Date() })
      .where(eq(issues.id, issueId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update issue categories error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
