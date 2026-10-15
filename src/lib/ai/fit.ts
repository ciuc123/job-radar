import { z } from "zod";
import { runStructuredWithUsage } from "@/lib/ai/client";
import { PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import type { ScoringProfile } from "@/lib/types";

// The score range is enforced after parsing: structured outputs do not support numeric bounds.
export const fitAnalysisSchema = z.object({
  score: z.number(),
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

// Job text beyond this adds cost without changing the fit assessment; the full text stays in the database.
const MAX_DESCRIPTION_CHARS = 6000;

// Scoring knobs are irrelevant to the model and would only add tokens.
function profileForPrompt(profile: ScoringProfile) {
  const { headline, experienceYears, experienceSummary, preferredTitles, strongSkills, secondarySkills, preferredLocations, excludedLocations, preferredEmploymentTypes, negativeSignals, salaryMinimum } = profile;
  return { headline, experienceYears, experienceSummary, preferredTitles, strongSkills, secondarySkills, preferredLocations, excludedLocations, preferredEmploymentTypes, negativeSignals, salaryMinimum };
}

export function buildFitPrompt(profile: ScoringProfile, job: FitJob, rulesScore: number) {
  // Pick fields explicitly: callers pass full DB rows that also carry raw feed data and internal ids.
  const listing = {
    title: job.title, company: job.company, location: job.location, remoteType: job.remoteType, countries: job.countries,
    timezoneRequirements: job.timezoneRequirements, employmentType: job.employmentType, contractType: job.contractType, seniority: job.seniority,
    salary: job.salaryMin != null || job.salaryMax != null ? { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency, period: job.salaryPeriod } : "not stated",
    technologies: job.technologies, rulesBasedScore: rulesScore, description: job.description.slice(0, MAX_DESCRIPTION_CHARS),
  };
  return {
    system: SYSTEM_PROMPT,
    // Stable prefix first (instructions, then this user's profile) so consecutive analyses for the same user hit the prompt cache.
    cachedSystem: `<candidate_profile>\n${JSON.stringify(profileForPrompt(profile), null, 2)}\n</candidate_profile>`,
    content: `<job_listing>\n${JSON.stringify(listing, null, 2)}\n</job_listing>\n\nAnalyze how well this listing fits the candidate.`,
  };
}

export const clampScore = (score: number) => Math.round(Math.min(100, Math.max(0, score)));

/** One metered fit analysis. `userId` is null for offline evals. */
export async function analyzeJobFit(userId: string | null, profile: ScoringProfile, job: FitJob, rulesScore: number, options: { model: string; effort?: "low" | "medium" | "high" }) {
  const { output, usage, costMicroUsd } = await runStructuredWithUsage({
    userId, feature: "job_analysis", model: options.model, effort: options.effort ?? "low", maxTokens: 4000,
    ...buildFitPrompt(profile, job, rulesScore), schema: fitAnalysisSchema,
  });
  return { analysis: { ...output, score: clampScore(output.score) }, usage, costMicroUsd, model: options.model, promptVersion: PROMPT_VERSION };
}
