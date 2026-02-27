import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, signToken } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { USER_ROLES } from "@/constants/roles";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum([USER_ROLES.ADMIN, USER_ROLES.DEVELOPER, USER_ROLES.QA, USER_ROLES.VIEWER]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    
    const { name, email, password, role } = validation.data;
    
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered", code: "EMAIL_EXISTS" },
        { status: 400 }
      );
    }
    
    // Hash password and create user
    const passwordHash = await hashPassword(password);
    
    const [newUser] = await db.insert(users).values({
      name,
      email,
      passwordHash,
      role: role || USER_ROLES.DEVELOPER,
    }).returning();
    
    // Generate token
    const token = signToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role as typeof USER_ROLES[keyof typeof USER_ROLES],
    });
    
    return NextResponse.json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
      token,
    }, { status: 201 });
    
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
