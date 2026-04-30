import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contextEntries, issues, projects, treemapPaths } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { and, desc, eq } from "drizzle-orm";
import { ERR, ensureProjectAccess, logContextActivity, syncEntryEmbedding } from "@/lib/context-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) return ERR.unauth();
    if (authUser.role !== "Admin") return ERR.forbidden("Only admins can generate questions");
    const { id } = await params;
    const projectId = parseInt(id);
    if (isNaN(projectId)) return ERR.invalidId();
    if (!(await ensureProjectAccess(projectId, authUser.id, authUser.role))) return ERR.forbidden();

    const llmUrl = process.env.LOCAL_LLM_URL;
    const llmModel = process.env.LOCAL_LLM_MODEL;
    const llmKey = process.env.LOCAL_LLM_CLIENT_KEY;
    if (!llmUrl || !llmModel || !llmKey) {
      return NextResponse.json({ error: "LLM configuration missing", code: "LLM_MISSING" }, { status: 500 });
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, name: true, key: true, description: true },
    });
    if (!project) return ERR.notFound("Project not found");

    const recentIssues = await db.query.issues.findMany({
      where: eq(issues.projectId, projectId),
      orderBy: desc(issues.updatedAt),
      limit: 30,
      columns: { id: true, title: true, type: true, status: true, priority: true },
    });

    const recentEntries = await db.query.contextEntries.findMany({
      where: eq(contextEntries.projectId, projectId),
      orderBy: desc(contextEntries.updatedAt),
      limit: 40,
      columns: { id: true, kind: true, title: true, body: true },
    });

    const untestedPaths = await db
      .select({ path: treemapPaths.path })
      .from(treemapPaths)
      .where(and(eq(treemapPaths.projectId, projectId), eq(treemapPaths.tested, false)))
      .limit(40);

    const issueLines = recentIssues.map(i => `- #${i.id} [${i.type}/${i.status}/${i.priority}] ${i.title}`).join("\n") || "(none)";
    const entryLines = recentEntries.map(e => `- [${e.kind}] ${e.title || ""}: ${(e.body || "").slice(0, 200)}`).join("\n") || "(none)";
    const pathLines = untestedPaths.map(p => `- ${p.path}`).join("\n") || "(none)";

    const userPrompt = `Project: ${project.name} (${project.key})
Description: ${project.description || "(none)"}

Recent issues:
${issueLines}

Existing context entries:
${entryLines}

Untested code paths from treemap:
${pathLines}

Generate 5 to 7 sharp scope questions a senior QA tester should ask to surface untested behavior, hidden requirements, edge cases, or risky areas. Each question must be:
- Concrete (mention a specific feature, path, status, or scenario from above when possible)
- Actionable (testable or answerable, not vague)
- Non-duplicative of existing entries

Return ONLY a JSON array of strings. No prose, no markdown fences. Example: ["Question 1?", "Question 2?"]`;

    const res = await fetch(llmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmKey}` },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: "system", content: "You are a senior QA engineer. You only respond with a valid JSON array of question strings." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[generate-questions] LLM error:", t);
      return NextResponse.json({ error: "LLM call failed", code: "LLM_ERROR" }, { status: 502 });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "";
    let questions: string[] = [];
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) questions = parsed.filter((s: unknown) => typeof s === "string" && s.trim());
    } catch {
      questions = raw.split(/\n+/).map((l: string) => l.replace(/^[-*\d.\s]+/, "").trim()).filter((l: string) => l.endsWith("?"));
    }
    questions = questions.slice(0, 7);
    if (questions.length === 0) {
      return NextResponse.json({ error: "AI returned no questions", code: "EMPTY_RESPONSE" }, { status: 502 });
    }

    const inserted: number[] = [];
    for (const q of questions) {
      const row = await db
        .insert(contextEntries)
        .values({
          projectId,
          kind: "question",
          title: null,
          body: q,
          source: "ai",
          pinned: false,
          createdBy: authUser.id,
        })
        .returning({ id: contextEntries.id });
      const entryId = row[0].id;
      inserted.push(entryId);
      await syncEntryEmbedding(entryId, q);
      await logContextActivity(projectId, entryId, authUser.id, "ai_generated", null, "question");
    }

    return NextResponse.json({ created: inserted.length, ids: inserted, questions });
  } catch (e) {
    console.error("[generate-questions]", e);
    return ERR.internal();
  }
}
