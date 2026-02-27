import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["Admin", "Developer", "QA", "Viewer"]).optional(),
});

// GET /api/users - List all users with search and pagination (Admin only)
export async function GET(request: NextRequest) {
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
        { error: "Only admins can view all users", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    let whereClause;
    if (search) {
      whereClause = or(
        like(users.name, `%${search}%`),
        like(users.email, `%${search}%`)
      );
    }

    const allUsers = await db.query.users.findMany({
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      where: whereClause,
      orderBy: desc(users.createdAt),
      limit,
      offset,
    });

    const countResult = await db.select({ count: users.id }).from(users).where(whereClause);
    const total = countResult.length;

    return NextResponse.json({ 
      users: allUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
