import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import type { ScoringProfile } from "@/lib/types";

export const DEFAULT_AI_MODEL = "claude-opus-5-5";

export const fitAnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  recommendation: z.enum(["APPLY", "REVIEW", "MAYBE", "REJECT"]),
  estimated_fit: z.enum(["excellent", "good", "fair", "poor"]),
  summary: z.string(),
  matches: z.array(z.string()),
  gaps: z.array(z.string()),
  concerns: z.array(z.string()),
  talking_points: z.array(z.string()),
});
export type FitAnalysis = z.infer<typeof fitAnalysisSchema>;

export type FitJob = {
  title: string; company: string; description: string; location: string; remoteType: string; seniority: string;
  countries: string[]; timezoneRequirements: string[]; employmentType: string[]; contractType: string[]; technologies: string[];
  salaryMin?: number | null; salaryMax?: number | null; salaryCurrency?: string | null; salaryPeriod?: string | null;
};

export type FitUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsdMicros: number | null };
export type FitResult = { analysis: FitAnalysis; usage: FitUsage; model: string; promptVersion: string };

// USD per 1M tokens. Cache writes (5-minute TTL) bill at 1.25x input. Unknown models report null cost.
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export function costUsdMicros(model: string, usage: Omit<FitUsage, "costUsdMicros">) {
  const price = PRICES[model];
  if (!price) return null;
  // Price per 1M tokens equals micro-dollars per token.
  return Math.round(usage.inputTokens * price.input + usage.outputTokens * price.output + usage.cacheReadTokens * price.cacheRead + usage.cacheWriteTokens * price.input * 1.25);
}

export const aiModel = () => process.env.AI_MODEL || DEFAULT_AI_MODEL;
export const isAiConfigured = () => process.env.AI_ANALYSIS_ENABLED === "true" && Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic({ timeout: 60_000 }));

// Scoring knobs are irrelevant to the model and would only add tokens.
function profileForPrompt(profile: ScoringProfile) {
  const { headline, experienceYears, experienceSummary, preferredTitles, strongSkills, secondarySkills, preferredLocations, excludedLocations, preferredEmploymentTypes, negativeSignals, salaryMinimum } = profile;
  return { headline, experienceYears, experienceSummary, preferredTitles, strongSkills, secondarySkills, preferredLocations, excludedLocations, preferredEmploymentTypes, negativeSignals, salaryMinimum };
}

export function buildFitRequest(profile: ScoringProfile, job: FitJob, deterministicScore: number) {
  // Pick fields explicitly: callers pass full DB rows that also carry raw feed data and internal ids.
  const listing = {
    title: job.title, company: job.company, location: job.location, remoteType: job.remoteType, countries: job.countries,
    timezoneRequirements: job.timezoneRequirements, employmentType: job.employmentType, contractType: job.contractType, seniority: job.seniority,
    salary: job.salaryMin != null || job.salaryMax != null ? { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency, period: job.salaryPeriod } : "not stated",
    technologies: job.technologies, rulesBasedScore: deterministicScore, description: job.description,
  };
  return {
    model: aiModel(),
    max_tokens: 4000,
    output_config: { effort: "low" as const, format: zodOutputFormat(fitAnalysisSchema) },
    // Stable prefix first (instructions, then this user's profile) so consecutive analyses for the same user hit the prompt cache.
    system: [
      { type: "text" as const, text: SYSTEM_PROMPT },
      { type: "text" as const, text: `<candidate_profile>\n${JSON.stringify(profileForPrompt(profile), null, 2)}\n</candidate_profile>`, cache_control: { type: "ephemeral" as const } },
    ],
    messages: [{ role: "user" as const, content: `<job_listing>\n${JSON.stringify(listing, null, 2)}\n</job_listing>\n\nAnalyze how well this listing fits the candidate.` }],
  };
}

export async function analyzeJobFit(profile: ScoringProfile, job: FitJob, deterministicScore: number): Promise<FitResult> {
  const request = buildFitRequest(profile, job, deterministicScore);
  const response = await getClient().messages.parse(request);
  if (response.stop_reason === "refusal") throw new Error("ai_refused");
  if (response.stop_reason !== "end_turn" || !response.parsed_output) throw new Error(`ai_incomplete:${response.stop_reason}`);
  const tokens = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
  return { analysis: response.parsed_output, usage: { ...tokens, costUsdMicros: costUsdMicros(request.model, tokens) }, model: request.model, promptVersion: PROMPT_VERSION };
}
