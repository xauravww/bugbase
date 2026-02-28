import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAuthUser, verifyPassword, hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

// POST /api/auth/change-password - Change user password
export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = changePasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Get user with password hash
    const user = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, authUser.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
