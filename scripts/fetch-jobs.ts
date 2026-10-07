import { sourceRegistry } from "@/lib/sources/registry";
import { runFetchPipeline } from "@/lib/sources/pipeline";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to fetch and save jobs");
const started = Date.now();
console.info(JSON.stringify({ event: "fetch.started", sourceCount: sourceRegistry.length, at: new Date().toISOString() }));
const results = await runFetchPipeline(sourceRegistry);
console.info(JSON.stringify({ event: "fetch.completed", results, durationMs: Date.now() - started, at: new Date().toISOString() }));
if (results.some((result) => !result.ok)) process.exitCode = 1;
