import { defaultProfile } from "@/lib/profile";
import type { NormalizedJob, Recommendation, ScoredJob, ScoringProfile } from "@/lib/types";

const strongWeightBySkill: Record<string, number> = { PHP: 20, Laravel: 25, Symfony: 10, MySQL: 4, Redis: 5, AWS: 8, Docker: 5, "REST APIs": 10 };
const secondaryWeight = 2;
const maxPositive = 128;

const has = (text: string, expression: RegExp) => expression.test(text);
const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function recommendationFor(score: number, thresholds = defaultProfile.thresholds): Recommendation {
  if (score >= thresholds.apply) return "APPLY";
  if (score >= thresholds.review) return "REVIEW";
  if (score >= thresholds.maybe) return "MAYBE";
  return "REJECT";
}

export function scoreJob(job: NormalizedJob, profile: ScoringProfile = defaultProfile): ScoredJob {
  const title = job.title.toLowerCase();
  const description = job.description.toLowerCase();
  const text = `${title} ${description}`;
  const locationText = `${job.location} ${job.countries.join(" ")} ${job.timezoneRequirements.join(" ")}`.toLowerCase();
  const breakdown: Record<string, number> = {};
  const add = (key: string, points: number) => { if (points) breakdown[key] = points; };
  const weight = (key: string, fallback: number) => profile.scoreWeights[key] ?? fallback;
  const hasNegativeSignal = (...signals: string[]) => signals.some((signal) => profile.negativeSignals.some((configured) => configured.toLowerCase().includes(signal)));

  for (const skill of profile.strongSkills) {
    const canonical = skill === "Backend development" ? "backend" : skill;
    const points = weight(skill, strongWeightBySkill[skill] ?? 3);
    const titleMatch = has(title, new RegExp(escapeRegex(canonical.toLowerCase()), "i"));
    const descriptionMatch = has(description, new RegExp(escapeRegex(canonical.toLowerCase()), "i"));
    if (titleMatch || descriptionMatch) {
      const central = titleMatch || new RegExp(`\\b(?:primary|core|central|building|developing|maintaining)\\b.{0,50}\\b${escapeRegex(canonical.toLowerCase())}\\b`, "i").test(description);
      const legacyOnly = /legacy|minor|nice.to.have|not required|little experience/i.test(description) && /php|laravel/i.test(canonical);
      add(`skill.${skill}`, legacyOnly ? Math.round(points * 0.25) : central ? points : Math.max(1, Math.round(points * 0.65)));
    }
  }
  for (const skill of profile.secondarySkills) {
    if (has(text, new RegExp(escapeRegex(skill.toLowerCase()), "i"))) add(`skill.${skill}`, weight(skill, secondaryWeight));
  }
  if (/backend|back-end|api engineer|server.side/i.test(`${title} ${description}`)) add("role.backend", weight("backend", 10));
  if (profile.preferredTitles.some((preferred) => title.includes(preferred.toLowerCase()))) add("role.preferred_title", weight("preferredTitle", 5));
  if (/\b(staff|principal)\b/i.test(title)) add("seniority.staff", weight("staff", 10));
  else if (/\blead\b/i.test(title)) add("seniority.lead", weight("lead", 8));
  else if (/\bsenior\b/i.test(title)) add("seniority.senior", weight("senior", 8));
  else if (/\bmid(?:-level)?\b/i.test(title)) add("seniority.mid", weight("mid", 2));
  if (hasNegativeSignal("junior", "entry-level", "graduate") && /\b(junior|entry.level|graduate)\b/i.test(title)) add("negative.junior", weight("juniorPenalty", -30));
  if (hasNegativeSignal("internship") && /\bintern(ship)?\b/i.test(title)) add("negative.internship", weight("internshipPenalty", -50));

  for (const preference of profile.preferredLocations) {
    const key = preference.toLowerCase();
    const points = key.includes("romania") ? 10 : key.includes("europe") ? 10 : key.includes("emea") ? 8 : key.includes("cet") ? 8 : key.includes("worldwide") ? 5 : 4;
    if (has(locationText, new RegExp(escapeRegex(preference), "i")) || (key === "cet" && /utc\s*[+-]0[0-3]\b/i.test(locationText))) add(`location.${key.replace(/[^a-z0-9]+/g, "_")}`, weight(`location.${key}`, points));
  }
  if (hasNegativeSignal("us-only") && /united states only|us.only|based in the us|must be located in the (?:us|united states)/i.test(locationText)) add("negative.location.us_only", weight("usOnlyPenalty", -30));
  if (hasNegativeSignal("canada-only") && /canada.only|must be located in canada/i.test(locationText)) add("negative.location.canada_only", weight("canadaOnlyPenalty", -30));
  if (hasNegativeSignal("india-only") && /india.only|must be located in india/i.test(locationText)) add("negative.location.india_only", weight("indiaOnlyPenalty", -30));
  if (hasNegativeSignal("on-site only") && /on.site|onsite|office based/i.test(`${job.remoteType} ${job.location} ${description}`)) add("negative.location.onsite", weight("onsitePenalty", -40));
  if (hasNegativeSignal("relocation required") && /relocation required|must relocate|relocation assistance required/i.test(text)) add("negative.relocation", weight("relocationPenalty", -30));
  for (const excluded of profile.excludedLocations) {
    if (["on-site", "onsite", "relocation required", "us-only", "canada-only", "india-only"].includes(excluded.toLowerCase())) continue;
    if (has(locationText, new RegExp(escapeRegex(excluded), "i"))) add(`negative.excluded.${excluded.toLowerCase()}`, -30);
  }

  const employment = [...job.employmentType, ...job.contractType].join(" ").toLowerCase();
  for (const type of profile.preferredEmploymentTypes) {
    if (employment.includes(type.toLowerCase()) || (type.toLowerCase() === "full-time remote" && employment.includes("full") && /remote/i.test(job.remoteType))) add(`employment.${type}`, weight(`employment.${type.toLowerCase()}`, type.toLowerCase() === "full-time remote" ? 7 : 10));
  }
  if (hasNegativeSignal("legacy php maintenance") && /legacy maintenance|legacy system|maintain legacy/i.test(description) && /\bphp\b|\blaravel\b/i.test(description)) add("negative.legacy_php", weight("legacyPhpPenalty", -15));
  if (profile.salaryMinimum && job.salaryMax !== undefined && job.salaryMax < profile.salaryMinimum) add("negative.salary_below_minimum", weight("salaryPenalty", -10));

  const raw = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const score = Math.max(0, Math.min(100, Math.round((raw / maxPositive) * 100)));
  return { ...job, score, scoreBreakdown: breakdown, recommendation: recommendationFor(score, profile.thresholds) };
}
