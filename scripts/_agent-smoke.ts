import { generateText, stepCountIs } from "ai";
import { chatModel } from "@/lib/ai/provider";
import { buildAgentTools, newSession } from "@/lib/ai/agent-tools";

const pid = Number(process.argv[2] || 6);
const q = process.argv[3] || "What is the current status and what is still left? Also build me a report.";

(async () => {
  const session = newSession(pid);
  const r = await generateText({
    model: chatModel(),
    system:
      `You are the BugBase project analyst for project ${pid}. Call tools before quoting any number. ` +
      `Tools return total_exact plus a capped sample and not_shown — always report the real total and ` +
      `say how many rows are not shown. Never present a capped list as complete. Use propose_export for reports.`,
    prompt: q,
    tools: buildAgentTools(session),
    stopWhen: stepCountIs(8),
    temperature: 0.2,
  });

  console.log("steps:", r.steps.length);
  console.log("tools:", r.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName)).join(", "));
  console.log("exports:", JSON.stringify(session.exports));
  console.log("usage:", JSON.stringify(r.usage));
  console.log("\n--- reply ---\n");
  console.log(r.text);
})();
