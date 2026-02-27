import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateTemplateSchema = z.object({
  event: z.string(),
  subject: z.string().min(1),
  body: z.string().min(1),
  enabled: z.boolean().optional(),
});

const createTemplateSchema = z.object({
  event: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  enabled: z.boolean().optional(),
});

// GET /api/settings/email-templates - Get all email templates
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser || authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const templates = await db.query.emailTemplates.findMany();

    return NextResponse.json({ templates });
    
  } catch (error) {
    console.error("Get templates error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT /api/settings/email-templates - Update email template
export async function PUT(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser || authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = updateTemplateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { event, subject, body: templateBody, enabled } = validation.data;

    const [updated] = await db.update(emailTemplates)
      .set({
        subject,
        body: templateBody,
        enabled: enabled ?? true,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.event, event))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Template not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template: updated });
    
  } catch (error) {
    console.error("Update template error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/settings/email-templates - Create custom email template
export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser || authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createTemplateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { event, subject, body: templateBody, enabled } = validation.data;

    const existing = await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.event, event),
    });

    if (existing) {
      return NextResponse.json(
        { error: "Template with this event already exists", code: "CONFLICT" },
        { status: 409 }
      );
    }

    const [created] = await db.insert(emailTemplates).values({
      event,
      subject,
      body: templateBody,
      enabled: enabled ?? true,
    }).returning();

    return NextResponse.json({ template: created }, { status: 201 });
    
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
