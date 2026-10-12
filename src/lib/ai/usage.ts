import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { aiConfig, modelPrices } from "@/lib/ai/config";

export type AiFeature = "profile_draft" | "score_explain" | "job_analysis" | "job_facts";
export type TokenUsage = { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number };

export class AiBudgetError extends Error {
  constructor(public readonly reason: "user_cap" | "global_budget", message: string) { super(message); }
}

/** Cost in micro-USD. Unknown models are priced at the highest known rate so a typo cannot hide spend. */
export function estimateCostMicroUsd(model: string, usage: TokenUsage): number {
  const price = modelPrices[model] ?? Object.values(modelPrices).reduce((max, item) => item.output > max.output ? item : max);
  const fresh = usage.inputTokens + (usage.cacheWriteTokens ?? 0) * 1.25 + (usage.cacheReadTokens ?? 0) * 0.1;
  return Math.ceil(fresh * price.input + usage.outputTokens * price.output);
}

const monthStart = () => { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); };

/** Throws AiBudgetError when the user's monthly call cap or the global monthly budget is exhausted. */
export async function assertAiBudget(userId: string | null, feature: AiFeature) {
  if (!db) return;
  const since = monthStart();
  // Bulk per-job work is bounded per run and by the global budget; only interactive features have a per-user monthly cap.
  if (userId && feature !== "job_analysis" && feature !== "job_facts") {
    const [{ calls }] = await db.select({ calls: sql<number>`count(*)::int` }).from(aiUsage).where(and(eq(aiUsage.userId, userId), eq(aiUsage.feature, feature), gte(aiUsage.createdAt, since)));
    if (calls >= aiConfig.monthlyCallCap) throw new AiBudgetError("user_cap", `Monthly AI limit reached for this feature (${aiConfig.monthlyCallCap} calls)`);
  }
  const [{ spent }] = await db.select({ spent: sql<number>`coalesce(sum(${aiUsage.costMicroUsd}), 0)::bigint` }).from(aiUsage).where(gte(aiUsage.createdAt, since));
  if (Number(spent) / 1_000_000 >= aiConfig.monthlyBudgetUsd) throw new AiBudgetError("global_budget", "The monthly AI budget has been reached");
}

export async function recordAiUsage(userId: string | null, feature: AiFeature, model: string, usage: TokenUsage) {
  const costMicroUsd = estimateCostMicroUsd(model, usage);
  console.info(JSON.stringify({ event: "ai.usage", userId, feature, model, ...usage, costUsd: costMicroUsd / 1_000_000 }));
  if (!db) return;
  await db.insert(aiUsage).values({ userId, feature, model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costMicroUsd });
}
