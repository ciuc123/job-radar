import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
async function main() {
  loadEnvConfig(process.cwd());
  const [{ db }, { jobs }, { realisticJobs }, { persistJobs }] = await Promise.all([
    import("@/db"), import("@/db/schema"), import("@/lib/demo-jobs"), import("@/lib/repository/jobs"),
  ]);
  if (!db) throw new Error("DATABASE_URL is required to seed jobs");
  const result = await persistJobs("sample", realisticJobs);
  const previewScores = new Map([["Acme", 94], ["Foo", 89], ["Bar", 84], ["Baz", 72], ["JVM Co", 48], ["Start", 25], ["US Corp", 10]]);
  for (const [company, score] of previewScores) {
    const job = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.company, company)).limit(1);
    if (job[0]) await db.update(jobs).set({ score, recommendation: score >= 85 ? "APPLY" : score >= 70 ? "REVIEW" : score >= 50 ? "MAYBE" : "REJECT", scoreBreakdown: { "sample.preview_score": score }, updatedAt: new Date() }).where(eq(jobs.id, job[0].id));
  }
  console.info(JSON.stringify({ event: "seed.completed", ...result, note: "Curated fixture scores are preview examples; live fetched jobs use deterministic scoring." }));
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
