import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const [{ db }, { extractMissingJobFacts }] = await Promise.all([import("@/db"), import("@/lib/ai/job-facts")]);
  if (!db) throw new Error("DATABASE_URL is required to extract job facts");
  const extracted = await extractMissingJobFacts();
  console.info(JSON.stringify({ event: "jobs.facts_completed", extracted }));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
