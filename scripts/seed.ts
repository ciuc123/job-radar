import { loadEnvConfig } from "@next/env";
async function main() {
  loadEnvConfig(process.cwd());
  const [{ db }, { realisticJobs }, { persistJobs }] = await Promise.all([
    import("@/db"), import("@/lib/demo-jobs"), import("@/lib/repository/jobs"),
  ]);
  if (!db) throw new Error("DATABASE_URL is required to seed jobs");
  const result = await persistJobs("sample", realisticJobs);
  console.info(JSON.stringify({ event: "seed.completed", ...result, note: "Sample jobs use the same deterministic scoring tiers as fetched jobs." }));
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
