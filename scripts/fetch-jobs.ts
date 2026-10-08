import { loadEnvConfig } from "@next/env";
async function main() {
  loadEnvConfig(process.cwd());
  const [{ sourceRegistry }, { runFetchPipeline }] = await Promise.all([
    import("@/lib/sources/registry"), import("@/lib/sources/pipeline"),
  ]);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to fetch and save jobs");
  const started = Date.now();
  console.info(JSON.stringify({
    event: "fetch.started",
    registeredSources: sourceRegistry.length,
    enabledSources: sourceRegistry.filter((source) => source.enabled && source.available).length,
    at: new Date().toISOString(),
  }));
  const results = await runFetchPipeline(sourceRegistry);
  console.info(JSON.stringify({ event: "fetch.completed", results, durationMs: Date.now() - started, at: new Date().toISOString() }));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
