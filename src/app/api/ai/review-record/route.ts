import { NextResponse } from "next/server";
import { MODULE_HELP, FIELD_HELP } from "@/lib/modules/help";
import { getMeta, MODULE_META } from "@/lib/modules/meta";

/**
 * POST /api/ai/review-record
 *
 * Reviews a whole PM record against what its module is actually for, and
 * returns suggested improvements per field.
 *
 * This endpoint NEVER mutates anything. It returns suggestions only — the user
 * decides field by field in the UI whether to apply them. Original values are
 * echoed back with each finding so the UI can show current vs suggested side by
 * side, and so a suggestion can never silently replace something the user wrote.
 *
 * Body: { module: string, fields: Record<string, string> }
 * Returns: {
 *   summary: string,
 *   belongsHere: boolean,
 *   belongsIn?: string,          // module label, when the record is in the wrong place
 *   findings: Array<{
 *     field: string,             // field key
 *     label: string,
 *     problem: string,
 *     suggestion: string,        // proposed replacement text ("" when nothing to propose)
 *     severity: "high" | "medium" | "low",
 *     current: string,
 *   }>
 * }
 */

interface RawFinding {
  field?: unknown;
  problem?: unknown;
  suggestion?: unknown;
  severity?: unknown;
}

interface RawReview {
  summary?: unknown;
  belongsHere?: unknown;
  belongsIn?: unknown;
  findings?: unknown;
}

/** Pulls the first JSON object out of a model reply, tolerating code fences and stray prose. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asSeverity(v: unknown): "high" | "medium" | "low" {
  const s = String(v ?? "").toLowerCase();
  return s === "high" || s === "medium" || s === "low" ? s : "medium";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const moduleSlug: string = body?.module ?? "";
    const fields: Record<string, unknown> = body?.fields ?? {};

    const meta = getMeta(moduleSlug);
    const help = MODULE_HELP[moduleSlug];
    if (!meta || !help) {
      return NextResponse.json({ error: "Unknown module" }, { status: 400 });
    }

    // Only review fields the module actually declares, and only ones with content.
    const filled = meta.fields
      .map((f) => ({ def: f, value: String(fields[f.key] ?? "").trim() }))
      .filter((f) => f.value !== "");

    if (filled.length === 0) {
      return NextResponse.json({
        summary: "There is nothing filled in yet, so there is nothing to check.",
        belongsHere: true,
        findings: [],
      });
    }

    const llmUrl = process.env.LOCAL_LLM_URL;
    const llmModel = process.env.LOCAL_LLM_MODEL;
    const llmKey = process.env.LOCAL_LLM_CLIENT_KEY;
    if (!llmUrl || !llmModel || !llmKey) {
      return NextResponse.json({ error: "LLM configuration missing" }, { status: 500 });
    }

    // What this module is for, in the same words the user sees in the ℹ modal.
    const moduleBrief = [
      `Record type: ${meta.singular} (module "${meta.label}")`,
      `What it is: ${help.whatItIs}`,
      `Why it matters: ${help.whyItMatters}`,
      `Belongs here:\n${help.writeThis.map((s) => `- ${s}`).join("\n")}`,
      `Does NOT belong here:\n${help.notThis.map((s) => `- ${s}`).join("\n")}`,
    ].join("\n\n");

    // Field-by-field expectations, so a finding can cite a concrete standard.
    const fieldBrief = filled
      .map(({ def }) => {
        const fh = FIELD_HELP[`${moduleSlug}.${def.key}`];
        const bits = [`- ${def.key} ("${def.label}", type ${def.type})`];
        if (fh?.whatItIs) bits.push(`  purpose: ${fh.whatItIs}`);
        if (fh?.template) bits.push(`  expected shape: ${fh.template.replace(/\n/g, " / ")}`);
        if (def.options?.length) bits.push(`  allowed values: ${def.options.join(", ")}`);
        return bits.join("\n");
      })
      .join("\n");

    const recordDump = filled.map(({ def, value }) => `### ${def.key} (${def.label})\n${value}`).join("\n\n");

    const otherModules = Object.values(MODULE_META)
      .filter((m) => m.slug !== moduleSlug)
      .map((m) => `${m.label}: ${MODULE_HELP[m.slug]?.whatItIs ?? m.singular}`)
      .join("\n");

    const userPrompt = `${moduleBrief}

FIELDS ON THIS RECORD:
${fieldBrief}

THE RECORD AS FILLED IN RIGHT NOW:
${recordDump}

OTHER RECORD TYPES THAT EXIST IN THIS TOOL:
${otherModules}

Your job:
1. Decide whether this content really belongs as a ${meta.singular}, or whether it describes something that belongs under a different record type.
2. For each field that could be better, say what is wrong and give an improved version of that field.

Rules for your suggestions:
- Keep every fact, name, number, date and technical detail the author already wrote. Never drop information.
- Never invent facts the author did not provide. If something important is missing, say so in "problem" and leave a clear placeholder like [who owns this?] inside your suggestion rather than making something up.
- A suggestion must be the complete replacement text for that field, not a comment about it.
- Only report a field if there is a real improvement. Do not report fields that are already fine.
- Use plain, simple language.
- Report at most 6 findings, most important first.

Answer with JSON only, in exactly this shape:
{
  "summary": "one or two sentences on the overall state of this record",
  "belongsHere": true,
  "belongsIn": "",
  "findings": [
    {
      "field": "exact field key from the list above",
      "problem": "what is wrong with it, in one sentence",
      "suggestion": "the full improved text for this field",
      "severity": "high"
    }
  ]
}

Set "belongsHere" to false and "belongsIn" to the name of the better record type only if the content clearly belongs elsewhere. Use severity "high" for something that makes the record unusable, "medium" for a real gap, "low" for polish.`;

    const response = await fetch(llmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmKey}`,
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          {
            role: "system",
            content:
              "You review project management records and suggest improvements. You are careful and conservative: you preserve every fact the author wrote, you never invent details, and you never suggest deleting someone's content. You reply with JSON only, no prose around it.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM API Error:", errorText);
      return NextResponse.json({ error: "Failed to review the record" }, { status: 500 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ error: "No content returned from AI" }, { status: 500 });
    }

    const parsed = extractJson(raw) as RawReview | null;
    if (!parsed) {
      return NextResponse.json({ error: "Could not read the AI response. Try again." }, { status: 502 });
    }

    const byKey = new Map(filled.map((f) => [f.def.key, f]));

    // Drop anything that does not name a real, filled field, or that suggests
    // emptying a field — the whole point is that nothing gets destroyed.
    const findings = (Array.isArray(parsed.findings) ? (parsed.findings as RawFinding[]) : [])
      .map((f) => {
        const key = String(f.field ?? "");
        const target = byKey.get(key);
        if (!target) return null;
        const suggestion = String(f.suggestion ?? "").trim();
        const problem = String(f.problem ?? "").trim();
        if (!problem) return null;
        if (suggestion === target.value) return null;
        return {
          field: key,
          label: target.def.label,
          problem,
          suggestion,
          severity: asSeverity(f.severity),
          current: target.value,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .slice(0, 6);

    const belongsHere = parsed.belongsHere !== false;
    const belongsIn = String(parsed.belongsIn ?? "").trim();

    return NextResponse.json({
      summary: String(parsed.summary ?? "").trim() || "Reviewed this record.",
      belongsHere,
      ...(belongsHere ? {} : { belongsIn }),
      findings,
    });
  } catch (error) {
    console.error("AI Review Record Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
