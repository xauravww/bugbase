import { NextResponse } from "next/server";
import { reviewRecord } from "@/lib/ai/review-record";
import { getMeta } from "@/lib/modules/meta";

/**
 * POST /api/ai/review-record
 *
 * Reviews a whole PM record against what its module is actually for, and
 * returns suggested improvements per field.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const moduleSlug: string = body?.module ?? "";
    const fields: Record<string, unknown> = body?.fields ?? {};

    const meta = getMeta(moduleSlug);
    if (!meta) {
      return NextResponse.json({ error: "Unknown module" }, { status: 400 });
    }

    const review = await reviewRecord(moduleSlug, fields);
    if (!review) {
      return NextResponse.json({ error: "Failed to review the record or LLM unavailable" }, { status: 500 });
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error("AI Review Record Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
