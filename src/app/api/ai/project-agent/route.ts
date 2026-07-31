/**
 * POST /api/ai/project-agent
 *
 * Conversational agent scoped to one project, built on the Vercel AI SDK. The
 * SDK owns the tool-calling loop (`generateText` + `stopWhen`), so this route
 * only resolves access, describes the tools, and returns the reply plus any
 * export download buttons the model asked the UI to render.
 *
 * Body: {
 *   projectId: number,
 *   message: string,
 *   history?: Array<{ role: "user" | "assistant", content: string }>
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { accessibleProjectIds } from "@/lib/modules/crud";
import { chatModel } from "@/lib/ai/provider";
import {
  buildAgentTools, newSession, projectMemberNames, type ExportProposal,
} from "@/lib/ai/agent-tools";
import { MODULE_META } from "@/lib/modules/meta";
import { EXTRA_LIST } from "@/lib/modules/export-extras";

export const runtime = "nodejs";

/** Tool-calling steps before the SDK must produce a final answer. */
const MAX_STEPS = 8;
/** How much prior conversation to replay. Older turns are dropped. */
const HISTORY_TURNS = 12;

function systemPrompt(
  project: { name: string; key: string },
  memberNames: string[],
  today: string
): string {
  const slugs = [...Object.keys(MODULE_META), ...EXTRA_LIST.map((e) => e.slug)].join(", ");
  return `You are the BugBase project analyst for "${project.name}" (${project.key}). Today is ${today}.

Your job is to give a manager complete clarity on this project: what is done, what is left, what is
stuck, who is carrying what, and what is coming next. You answer only about this project.

HOW TO WORK
- Always call tools before stating any number. Never estimate, never recall a figure from an earlier turn.
- Start with get_project_overview for status questions. It returns exact counts.
- Follow up with list_work_items, get_forward_look, get_team_workload or search_records as needed.
- Prefer a few well-chosen calls over many redundant ones.
- Leave startDate and endDate empty unless the user names a period. The default window is the last 30
  days. Never invent a start date, and never widen the window to make totals look larger — open-work
  and backlog counts already cover the whole project regardless of the window.
- Refer to people by name, or as "they", never "he" or "she". A name does not tell you someone's gender.

NUMBERS ARE EXACT, SAMPLES ARE NOT
- Tools return "total_exact" alongside a capped list of example rows plus "not_shown".
- Quote total_exact as the real number. When rows are omitted, say so explicitly:
  "12 items remain open; the 6 highest-priority ones are listed, 6 more are not shown."
- Never imply a capped list is the whole set. This is the single most important rule.

BE HONEST ABOUT GAPS
- If a tool returns zero rows, say the data is not tracked rather than inventing a plausible answer.
- If no milestones, sprints or releases exist, state plainly that future goals are not recorded in
  BugBase yet, and suggest adding them. Do not fabricate a roadmap.

WHAT A MANAGER NEEDS
Lead with the answer, then the evidence. Cover, when relevant: progress in the period, blockers and
why each is blocked, overdue and unassigned work, workload imbalance, upcoming commitments with
dates, and open risks. Flag anything that needs action — an unassigned critical bug, a milestone
already past its target, one person holding most of the open work.

REPORTS
When a downloadable report would help, call propose_export — but only AFTER you have gathered the
data with the other tools, never as your first call. The UI renders the download button. Never write
a URL and never claim a file is attached. Pass real module slugs, or ["all"] for the whole
workspace. Valid slugs: ${slugs}.

ALWAYS FINISH WITH AN ANSWER
Tool calls are not an answer. After your last tool call you must write the reply itself, in prose,
containing the actual numbers and findings. Never end your turn with only a tool call, and never
describe what you did ("I called the export function") instead of answering the question.

STYLE
Plain language, no jargon, no filler. Short paragraphs or tight bullets. Use markdown. Reference
items by id (Issue #41) so the reader can find them. Never invent an id.

Team members on this project: ${memberNames.length ? memberNames.join(", ") : "none recorded"}.`;
}

export async function POST(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { projectId?: number; message?: string; history?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const projectId = Number(body.projectId);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!projectId || Number.isNaN(projectId)) {
    return NextResponse.json({ error: "projectId is required", code: "VALIDATION_ERROR" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "message is required", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  // Access is resolved here, once. The tools close over a fixed projectId, so
  // the model cannot widen its own scope through a crafted argument.
  const allowed = await accessibleProjectIds(authUser.id, authUser.role);
  if (!allowed.includes(projectId)) {
    return NextResponse.json({ error: "Not allowed for this project", code: "FORBIDDEN" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, name: true, key: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found", code: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const memberNames = await projectMemberNames(projectId);
    const session = newSession(projectId);

    const messages: ModelMessage[] = [];
    for (const turn of (body.history ?? []).slice(-HISTORY_TURNS)) {
      if (turn.role !== "user" && turn.role !== "assistant") continue;
      if (typeof turn.content !== "string" || !turn.content.trim()) continue;
      messages.push({ role: turn.role, content: turn.content });
    }
    messages.push({ role: "user", content: message });

    const result = await generateText({
      model: chatModel(),
      system: systemPrompt(project, memberNames, new Date().toISOString().slice(0, 10)),
      messages,
      tools: buildAgentTools(session),
      stopWhen: stepCountIs(MAX_STEPS),
      temperature: 0.2,
    });

    const toolsUsed = result.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
    let reply = result.text.trim();

    // Some models spend every step on tool calls and stop without writing
    // prose, or narrate the call instead of answering. The data was already
    // fetched, so rather than losing the turn we ask once more with the facts
    // inlined and no tools available — it can only write the answer now.
    if (!reply || /^(the )?function [`'"]?\w+/i.test(reply)) {
      if (session.facts.length > 0) {
        const retry = await generateText({
          model: chatModel(),
          system:
            "You are the BugBase project analyst. Answer the user's question using only the verified " +
            "data below. Every count in it is exact. Where a payload has not_shown greater than zero, " +
            "report total_exact as the real number and state how many rows are not listed. Write the " +
            "answer itself in plain markdown — never describe tool calls.",
          prompt: `Question: ${message}\n\nVerified data:\n${session.facts
            .map((f) => `[${f.tool}]\n${JSON.stringify(f.output, null, 2)}`)
            .join("\n\n")}`,
          temperature: 0.2,
        });
        reply = retry.text.trim();
      }
      if (!reply) {
        reply =
          "I could not complete the answer. The data was read but the model did not return a " +
          "summary — try asking a narrower question.";
      }
    }

    // De-duplicate export buttons so repeated propose_export calls render once.
    const seen = new Set<string>();
    const exports: ExportProposal[] = [];
    for (const e of session.exports) {
      const k = `${e.format}:${[...e.modules].sort().join(",")}`;
      if (seen.has(k)) continue;
      seen.add(k);
      exports.push(e);
    }

    return NextResponse.json({
      reply,
      exports,
      toolsUsed,
      steps: result.steps.length,
      usage: result.usage,
      project: { id: project.id, name: project.name, key: project.key },
    });
  } catch (error) {
    console.error("[ai/project-agent] error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    const status = msg === "LLM configuration missing" ? 503 : 500;
    return NextResponse.json({ error: msg, code: "AGENT_ERROR" }, { status });
  }
}
