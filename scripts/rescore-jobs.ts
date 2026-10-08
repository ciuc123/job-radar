import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const [{ db }, { rescoreJobs }] = await Promise.all([import("@/db"), import("@/lib/repository/jobs")]);
  if (!db) throw new Error("DATABASE_URL is required to rescore saved jobs");
  const rescored = await rescoreJobs();
  console.info(JSON.stringify({ event: "jobs.rescore_completed", rescored }));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
