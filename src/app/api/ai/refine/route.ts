import { NextResponse } from "next/server";
import { MODULE_HELP, FIELD_HELP } from "@/lib/modules/help";
import { getMeta } from "@/lib/modules/meta";

/**
 * Builds the module- and field-specific part of a suggest prompt from the same
 * help data the UI shows the user. Keeping one source means a module never ends
 * up with generic AI output just because it was missed in a hand-written list.
 */
function buildFieldInstructions(moduleSlug: string, field: string): string {
    const meta = getMeta(moduleSlug);
    const moduleHelp = MODULE_HELP[moduleSlug];
    const fieldHelp = FIELD_HELP[`${moduleSlug}.${field}`];
    const fieldDef = meta?.fields.find((f) => f.key === field);

    if (!meta || !moduleHelp) return "Write clearly and professionally for the given field.";

    const parts: string[] = [
        `You are filling in the "${fieldDef?.label ?? field}" field of a ${meta.singular} record.`,
        `A ${meta.singular} means: ${moduleHelp.whatItIs}`,
    ];

    if (fieldHelp?.whatItIs) parts.push(`This field specifically: ${fieldHelp.whatItIs}`);
    if (fieldHelp?.template) parts.push(`Follow this shape:\n${fieldHelp.template}`);
    if (fieldHelp?.example) parts.push(`Here is a good example of this field:\n${fieldHelp.example}`);
    if (fieldDef?.options?.length) parts.push(`Answer with exactly one of: ${fieldDef.options.join(", ")}.`);

    const exampleRow = moduleHelp.example.find((r) => r.label === fieldDef?.label);
    if (exampleRow && !fieldHelp?.example) {
        parts.push(`Here is a good example of this field:\n${exampleRow.value}`);
    }

    parts.push(
        "Write in plain, simple language a non-technical teammate can follow. " +
        "Do not add a heading, a preamble, or restate the field name."
    );

    return parts.join("\n\n");
}

export async function POST(req: Request) {
    try {
        const { content, field, mode, context } = await req.json();

        if (mode !== "suggest" && !content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        const llmUrl = process.env.LOCAL_LLM_URL;
        const llmModel = process.env.LOCAL_LLM_MODEL;
        const llmKey = process.env.LOCAL_LLM_CLIENT_KEY;

        if (!llmUrl || !llmModel || !llmKey) {
            return NextResponse.json({ error: "LLM configuration missing" }, { status: 500 });
        }

        const moduleSlug: string = context?.module || "";

        let prompt = "";
        if (mode === "suggest") {
            const contextStr = context
                ? Object.entries(context)
                    .filter(([k, v]) => v && k !== "module" && k !== "project")
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n")
                : "";

            prompt = [
                buildFieldInstructions(moduleSlug, field),
                contextStr
                    ? `The rest of this record is already filled in as follows. Stay consistent with it:\n${contextStr}`
                    : "The rest of this record is still empty, so write something plausible for this field on its own.",
                "Return only the value for this field, nothing else.",
            ].join("\n\n");
        } else if (moduleSlug && MODULE_HELP[moduleSlug]) {
            prompt = [
                buildFieldInstructions(moduleSlug, field),
                `Rewrite the text below so it is clearer and better organised, keeping every fact and detail the author already put in. Do not invent new information.\n\nText:\n${content}`,
                "Return only the rewritten value, nothing else.",
            ].join("\n\n");
        } else {
            if (field === "title") {
                prompt = `Refine the following issue title to be professional, concise, and clear. Ensure perfect grammar and a formal tone. Title: "${content}". Just return the refined title, nothing else.`;
            } else if (field === "description") {
                prompt = `Refine the following issue description to be professional, clear, and well-structured using markdown. Ensure excellent grammar, a professional tone, and make it easy to read for developers and stakeholders. Maintain all technical details. Content: "${content}". Just return the refined description, nothing else.`;
            } else if (field === "stepsToReproduce") {
                prompt = `Refine the following steps to reproduce an issue into a clean, numbered list format (Step 1:, Step 2:, etc.). Use clear, imperative language (e.g., "Click", "Navigate to", "Observe"). Ensure the tone is professional and instructions are unambiguous. Content: "${content}". Just return the refined steps, nothing else.`;
            } else if (field === "comment") {
                prompt = `Refine the following comment to be professional, constructive, and clear. Ensure it sounds like a helpful collaborator in a software project. Content: "${content}". Just return the refined comment, nothing else.`;
            } else if (field === "checklist_notes") {
                prompt = `Refine the following task notes to be clear, professional, and grammatically correct. Use direct language. Content: "${content}". Just return the refined notes, nothing else.`;
            } else {
                prompt = `Refine the following content to be professional, clear, and grammatically correct. Use a simple and direct tone. Content: "${content}". Just return the refined content, nothing else.`;
            }
        }

        const response = await fetch(llmUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${llmKey}`,
            },
            body: JSON.stringify({
                model: llmModel,
                messages: [
                    {
                        role: "system",
                        content: "You are an expert technical writer working inside a project management tool. You write requirements, bugs, meeting notes, risks, docs and similar records. Your output is grammatically perfect and exceptionally clear, in plain simple language anyone on the team can follow. Match the kind of record you are told you are writing. Never include conversational filler, preambles, or explanations; return ONLY the text for the field."
                    },
                    { role: "user", content: prompt },
                ],
                temperature: 0.1,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("LLM API Error:", errorText);
            return NextResponse.json({ error: "Failed to refine content using AI" }, { status: 500 });
        }

        const data = await response.json();
        const refinedContent = data.choices[0]?.message?.content?.trim();

        if (!refinedContent) {
            return NextResponse.json({ error: "No content returned from AI" }, { status: 500 });
        }

        return NextResponse.json({ refinedContent });
    } catch (error) {
        console.error("AI Refine Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
