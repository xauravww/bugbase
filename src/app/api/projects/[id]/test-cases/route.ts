import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testCases, projectMembers, projects } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, desc, and } from "drizzle-orm";
import { embedSafe, cosineSimilarity } from "@/lib/embeddings";
import { testCaseEmbeddings } from "@/lib/db/schema";
import * as sqliteVec from "sqlite-vec";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = parseInt(resolvedParams.id);
    const authUser = getAuthUser(request);

    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tests = await db.query.testCases.findMany({
      where: eq(testCases.projectId, projectId),
      orderBy: desc(testCases.createdAt),
      with: {
        creator: { columns: { name: true, email: true } },
        results: {
          with: { tester: { columns: { name: true } } },
          orderBy: (results, { desc }) => [desc(results.createdAt)]
        }
      }
    });

    return NextResponse.json({ testCases: tests });
  } catch (error) {
    console.error("GET test cases error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = parseInt(resolvedParams.id);
    const authUser = getAuthUser(request);

    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, description, steps, expectedResult, force } = await request.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    let embedding: Float32Array | null = null;
    const contentToEmbed = `${title}\n${description || ""}\n${steps || ""}`;
    
    if (!force) {
      // Fast exact title check (works even if embeddings API is offline)
      const exactDuplicate = await db.query.testCases.findFirst({
        where: and(eq(testCases.projectId, projectId), eq(testCases.title, title)),
      });
      
      if (exactDuplicate) {
        return NextResponse.json({ error: "Duplicate test case detected (exact title match).", existing: exactDuplicate }, { status: 409 });
      }

      // Embed content for deduplication
      embedding = await embedSafe(contentToEmbed);

      if (embedding) {
        const existingTests = await db.query.testCases.findMany({
          where: eq(testCases.projectId, projectId),
          with: { embedding: true },
        });

        for (const t of existingTests) {
          if (t.embedding?.vector) {
            try {
              const vecArr = JSON.parse(t.embedding.vector);
              const vec = Float32Array.from(vecArr);
              const sim = cosineSimilarity(embedding, vec);
              if (sim > 0.90) {
                return NextResponse.json({ error: "Duplicate test case detected based on semantic similarity.", existing: t }, { status: 409 });
              }
            } catch (e) {}
          }
        }
      }
    } else {
      embedding = await embedSafe(contentToEmbed);
    }

    const newTestCase = db.transaction((tx) => {
      const tcArray = tx.insert(testCases).values({
        projectId,
        title,
        description,
        steps,
        expectedResult,
        createdBy: authUser.id,
      }).returning().all();
      
      const tc = tcArray[0];

      if (embedding) {
        tx.insert(testCaseEmbeddings).values({
          testCaseId: tc.id,
          model: "nomic-embed-text",
          dim: 768,
          vector: JSON.stringify(Array.from(embedding)),
        }).run();
      }

      return tc;
    });

    return NextResponse.json({ testCase: newTestCase }, { status: 201 });
  } catch (error) {
    console.error("POST test case error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
