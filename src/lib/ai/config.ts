/** Central AI configuration. Prices are list prices (USD per million tokens) cached 2026-10-06; verify before relying on them. */
export const modelPrices: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

const intFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const aiConfig = {
  /** One-off, per-user work: profile/rubric drafts and score explanations. */
  get profileModel() { return process.env.AI_MODEL_PROFILE || "claude-sonnet-5-5"; },
  /** Bulk, per-job work: second-opinion analysis and job fact extraction. */
  get bulkModel() { return process.env.AI_MODEL_BULK || "claude-haiku-5-5"; },
  get monthlyCallCap() { return intFromEnv("AI_MONTHLY_CALL_CAP", 40); },
  get monthlyBudgetUsd() { return intFromEnv("AI_MONTHLY_BUDGET_USD", 60); },
  get maxJobsPerUserRun() { return intFromEnv("AI_MAX_JOBS_PER_USER_RUN", 30); },
  get concurrency() { return Math.max(1, intFromEnv("AI_CONCURRENCY", 4)); },
  /** 0 keeps the AI score out of ranking. Values up to 1 blend it with the rules score. */
  get blendWeight() { return Math.min(1, intFromEnv("AI_BLEND_WEIGHT", 0)); },
};

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const copilotEnabled = () => process.env.AI_COPILOT_ENABLED === "true" && aiConfigured();
export const analysisEnabled = () => process.env.AI_ANALYSIS_ENABLED === "true" && aiConfigured();
export const jobFactsEnabled = () => process.env.AI_JOB_FACTS_ENABLED === "true" && aiConfigured();
