import { NextResponse } from "next/server";

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

        let prompt = "";
        if (mode === "suggest") {
            const contextStr = context ? Object.entries(context).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") : "";
            prompt = `Based on the following context from an issue report:\n${contextStr}\n\nPlease suggest a professional, clear, and high-quality value for the field "${field}". Just return the suggested content, nothing else.`;
        } else {
            if (field === "title") {
                prompt = `Refine the following issue title to be professional, concise, and clear. Ensure perfect grammar and a formal tone. Title: "${content}". Just return the refined title, nothing else.`;
            } else if (field === "description") {
                prompt = `Refine the following issue description to be professional, clear, and well-structured using markdown. Ensure excellent grammar, a professional tone, and make it easy to read for developers and stakeholders. Maintain all technical details. Content: "${content}". Just return the refined description, nothing else.`;
            } else if (field === "stepsToReproduce") {
                prompt = `Refine the following steps to reproduce an issue into a clean, numbered list format (Step 1:, Step 2:, etc.). Use clear, imperative language (e.g., "Click", "Navigate to", "Observe"). Ensure the tone is professional and instructions are unambiguous. Content: "${content}". Just return the refined steps, nothing else.`;
            } else if (field === "comment") {
                prompt = `Refine the following comment to be professional, constructive, and clear. Ensure it sounds like a helpful collaborator in a software project. Content: "${content}". Just return the refined comment, nothing else.`;
            } else if (field === "milestone_title") {
                prompt = `Refine the following milestone title to be professional, outcome-oriented, and clear. Milestone Title: "${content}". Just return the refined title, nothing else.`;
            } else if (field === "milestone_description") {
                prompt = `Refine the following milestone description to be professional, clear, and inspiring. Focus on the value and goals of the milestone. Content: "${content}". Just return the refined description, nothing else.`;
            } else if (field === "checklist_notes") {
                prompt = `Refine the following task notes to be clear, professional, and grammatically correct. Use direct language. Content: "${content}". Just return the refined notes, nothing else.`;
            } else if (field === "milestone_note") {
                prompt = `Refine the following milestone activity note to be professional, objective, and clear. Content: "${content}". Just return the refined note, nothing else.`;
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
                        content: "You are an expert technical writer and QA engineer. Your goal is to refine bug report content to be professional, grammatically perfect, and exceptionally clear. Use a formal yet simple tone that is easy for anyone to understand. Never include conversational filler or explanations; return ONLY the refined text."
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
