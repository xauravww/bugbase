/**
 * Exercise the real /api/ai/project-agent handler in-process, so the actual
 * system prompt, access checks and fallback logic are covered.
 */
import { POST } from "@/app/api/ai/project-agent/route";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const pid = Number(process.argv[2] || 6);
const q = process.argv[3] || "What is the current status and what is still left?";

(async () => {
  const token = jwt.sign(
    { id: 1, email: "admin@bugbase.dev", role: "Admin", name: "Admin User" },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );

  const req = new NextRequest("http://localhost:3000/api/ai/project-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId: pid, message: q }),
  });

  const res = await POST(req);
  const data = await res.json();
  console.log("status:", res.status);
  console.log("tools:", (data.toolsUsed || []).join(", "));
  console.log("steps:", data.steps, "exports:", JSON.stringify(data.exports));
  console.log("\n--- reply ---\n");
  console.log(data.reply || data.error);
})();
