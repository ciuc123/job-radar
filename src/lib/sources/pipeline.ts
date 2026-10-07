import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceHealth } from "@/db/schema";
import { getScoringProfile, persistJobs } from "@/lib/repository/jobs";
import type { JobSource } from "@/lib/sources/job-source";

export type SourceRun = { source: string; ok: boolean; discovered: number; added: number; duplicates: number; durationMs: number; error?: string };

export async function runSourcesIndependently(sources: JobSource[], process: (source: JobSource) => Promise<{ discovered: number; added: number; duplicates: number }>): Promise<SourceRun[]> {
  const results: SourceRun[] = [];
  for (const source of sources) {
    if (!source.enabled || !source.available) continue;
    const started = Date.now();
    try {
      const metrics = await process(source);
      results.push({ source: source.id, ok: true, ...metrics, durationMs: Date.now() - started });
    } catch (error) {
      results.push({ source: source.id, ok: false, discovered: 0, added: 0, duplicates: 0, durationMs: Date.now() - started, error: error instanceof Error ? error.message : "Unknown source error" });
    }
  }
  return results;
}

export async function runFetchPipeline(sources: JobSource[]) {
  const enabled = sources.filter((source) => source.enabled && source.available);
  const profile = await getScoringProfile();
  if (db) for (const source of sources) {
    await db.insert(sourceHealth).values({ source: source.id, enabled: source.enabled, available: source.available, status: source.available ? "idle" : "unavailable", lastError: source.unavailableReason ?? null })
      .onConflictDoUpdate({ target: sourceHealth.source, set: { enabled: source.enabled, available: source.available, status: source.available ? "idle" : "unavailable", lastError: source.unavailableReason ?? null } });
  }
  const runs = await runSourcesIndependently(enabled, async (source) => {
    const startedAt = new Date();
    if (db) await db.update(sourceHealth).set({ status: "running", lastStartedAt: startedAt, lastError: null }).where(eq(sourceHealth.source, source.id));
    const result = await source.fetch();
    const metrics = await persistJobs(source.id, result.jobs, profile);
    if (db) await db.update(sourceHealth).set({ status: "healthy", lastCompletedAt: new Date(), discovered: metrics.discovered, added: metrics.added, duplicates: metrics.duplicates, durationMs: Date.now() - startedAt.getTime(), lastError: null }).where(eq(sourceHealth.source, source.id));
    return metrics;
  });
  if (db) for (const run of runs.filter((item) => !item.ok)) {
    await db.update(sourceHealth).set({ status: "error", lastCompletedAt: new Date(), durationMs: run.durationMs, lastError: run.error }).where(eq(sourceHealth.source, run.source));
  }
  return runs;
}
