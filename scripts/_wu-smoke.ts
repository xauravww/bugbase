import { POST } from "@/app/api/ai/work-update/route";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

(async () => {
  const token = jwt.sign(
    { id: 1, email: "admin@bugbase.dev", role: "Admin", name: "Admin User" },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );
  const req = new NextRequest("http://localhost:3000/api/ai/work-update", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      projectId: 6,
      sections: ["issues_done", "issues_left", "blockers", "team", "upcoming", "risks"],
    }),
  });
  const res = await POST(req);
  const data = await res.json();
  console.log("status:", res.status);
  console.log("stats:", JSON.stringify(data.stats));
  console.log("\n--- update ---\n");
  console.log(data.update || data.error);
})();
