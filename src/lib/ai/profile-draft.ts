import { z } from "zod";
import { defaultProfile } from "@/lib/profile";
import type { Rubric, ScoringProfile } from "@/lib/types";

/** Shape the model must return. Kept free of numeric bounds and records so it stays within structured-output schema limits; bounds are enforced in normalizeDraft. */
export const profileDraftSchema = z.object({
  headline: z.string(),
  experienceYears: z.number(),
  experienceSummary: z.string(),
  preferredTitles: z.array(z.string()),
  strongSkills: z.array(z.string()),
  secondarySkills: z.array(z.string()),
  preferredLocations: z.array(z.string()),
  excludedLocations: z.array(z.string()),
  preferredEmploymentTypes: z.array(z.string()),
  negativeSignals: z.array(z.string()),
  salaryMinimum: z.number().nullable(),
  roleFamilies: z.array(z.object({ name: z.string(), titlePatterns: z.array(z.string()) })),
  mustHaveSkills: z.array(z.string()),
  skillWeights: z.array(z.object({ skill: z.string(), weight: z.number() })),
  strongRequiresFullRemote: z.boolean(),
  strongRequiresSalary: z.boolean(),
  rationale: z.string(),
});
export type ProfileDraft = z.infer<typeof profileDraftSchema>;
export type NormalizedDraft = { profile: ScoringProfile; rationale: string };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const SENIORITY_WORDS = /\b(?:senior|sr\.?|lead|staff|principal|junior|jr\.?|mid(?:-level)?)\b/gi;

function cleanList(items: string[], maxItems: number, maxLength = 60) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim().slice(0, maxLength);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Turns an unverified model draft into a bounded ScoringProfile the scorer can safely consume. Pure and deterministic. */
export function normalizeDraft(draft: ProfileDraft): NormalizedDraft {
  const strongSkills = cleanList(draft.strongSkills, 15);
  const secondarySkills = cleanList(draft.secondarySkills, 20).filter((skill) => !strongSkills.some((strong) => strong.toLowerCase() === skill.toLowerCase()));
  const preferredTitles = cleanList(draft.preferredTitles, 10, 80);
  const known = new Set([...strongSkills, ...secondarySkills].map((skill) => skill.toLowerCase()));

  const scoreWeights: Record<string, number> = {};
  for (const { skill, weight } of draft.skillWeights) {
    const name = [...strongSkills, ...secondarySkills].find((item) => item.toLowerCase() === skill.trim().toLowerCase());
    if (name && Number.isFinite(weight)) scoreWeights[name] = Math.round(clamp(weight, -50, 50));
  }

  let roleFamilies = draft.roleFamilies
    .map((family) => ({ name: family.name.trim().slice(0, 60), titlePatterns: cleanList(family.titlePatterns, 8, 40).map((pattern) => pattern.toLowerCase()) }))
    .filter((family) => family.name && family.titlePatterns.length)
    .slice(0, 5);
  if (!roleFamilies.length) {
    const derived = cleanList(preferredTitles.map((title) => title.replace(SENIORITY_WORDS, "").replace(/\s+/g, " ").trim()), 6, 40).map((title) => title.toLowerCase());
    if (derived.length) roleFamilies = [{ name: "Preferred titles", titlePatterns: derived }];
  }
  // Every must-have skill narrows the review tier, so cap the list and keep only skills the profile actually claims.
  const mustHaveSkills = cleanList(draft.mustHaveSkills.filter((skill) => known.has(skill.trim().toLowerCase())), 3);
  const rubric: Rubric | null = roleFamilies.length
    ? { roleFamilies, mustHaveSkills, strongRequiresFullRemote: draft.strongRequiresFullRemote, strongRequiresSalary: draft.strongRequiresSalary }
    : null;

  const salaryMinimum = draft.salaryMinimum !== null && Number.isFinite(draft.salaryMinimum) && draft.salaryMinimum > 0 ? Math.round(draft.salaryMinimum) : null;
  return {
    rationale: draft.rationale.trim().slice(0, 2000),
    profile: {
      headline: draft.headline.trim().slice(0, 140),
      experienceYears: Math.round(clamp(Number.isFinite(draft.experienceYears) ? draft.experienceYears : 0, 0, 60)),
      experienceSummary: draft.experienceSummary.trim().slice(0, 600),
      preferredTitles, strongSkills, secondarySkills,
      preferredLocations: cleanList(draft.preferredLocations, 10),
      excludedLocations: cleanList(draft.excludedLocations, 10),
      preferredEmploymentTypes: cleanList(draft.preferredEmploymentTypes, 6),
      negativeSignals: cleanList(draft.negativeSignals, 12),
      salaryMinimum,
      thresholds: { ...defaultProfile.thresholds },
      scoreWeights,
      rubric,
    },
  };
}
