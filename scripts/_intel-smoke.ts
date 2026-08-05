import { buildSnapshot, renderSnapshot } from "@/lib/ai/project-intel";

const pid = Number(process.argv[2] || 6);
(async () => {
  const start = new Date(Date.now() - 30 * 86_400_000);
  const s = await buildSnapshot(pid, { start });
  console.log("health:", JSON.stringify(s.health, null, 2));
  console.log("buckets:", ["completed", "remaining", "blockers", "overdue", "unassigned", "stale"]
    .map((k) => `${k}=${(s as unknown as Record<string, { total: number }>)[k].total}`).join(" "));
  console.log("modules:", s.modules.map((m) => `${m.slug}=${m.total}`).join(" "));
  console.log("upcoming:", s.upcoming.milestones.length, "milestones,", s.upcoming.sprints.length, "sprints,", s.upcoming.releases.length, "releases");
  console.log("risks:", s.risks.length, "logs:", s.manualLogs.length);
  console.log("\n--- rendered (first 3000 chars) ---\n");
  console.log(renderSnapshot(s).slice(0, 3000));
})();
