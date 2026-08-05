import { buildSnapshot } from "@/lib/ai/project-intel";
(async () => {
  for (const startIso of ["2024-01-01", "2026-07-01"]) {
    const s = await buildSnapshot(6, { start: new Date(`${startIso}T00:00:00`) });
    console.log(startIso, "completedInRange:", s.health.completedInRange, "velocity:", s.health.velocityPerWeek);
  }
})();
