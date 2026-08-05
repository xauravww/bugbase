import { generateText, stepCountIs } from "ai";
import { chatModel } from "@/lib/ai/provider";
import { buildAgentTools, newSession } from "@/lib/ai/agent-tools";
const session = newSession(6);
(async () => {
  const r = await generateText({
    model: chatModel(),
    system: "Project analyst. Call tools before numbers. Use propose_export for reports.",
    prompt: "What is left? Build me a report.",
    tools: buildAgentTools(session),
    stopWhen: stepCountIs(8), temperature: 0.2,
  });
  r.steps.forEach((s, i) => {
    console.log(`\n=== step ${i} finish=${s.finishReason} textLen=${s.text.length}`);
    console.log("  calls:", s.toolCalls.map(c=>c.toolName).join(",") || "-");
    console.log("  results:", s.toolResults.map(t=>t.toolName).join(",") || "-");
    s.toolResults.forEach(t=>{ console.log("   ", t.toolName, JSON.stringify((t as any).output).slice(0,200)); });
  });
  console.log("\nfinal text:", JSON.stringify(r.text));
  console.log("exports:", JSON.stringify(session.exports));
})();
