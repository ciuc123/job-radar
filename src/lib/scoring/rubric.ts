import type { NormalizedJob, Rubric } from "@/lib/types";

const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const minorMarker = "(?:legacy|minor|optional|nice.to.have|not required|maintenance only)";

const mentions = (text: string, skill: string) => new RegExp(`(?<![a-z0-9])${escapeRegex(skill.toLowerCase())}(?![a-z0-9])`, "i").test(text);
const isMinor = (description: string, skill: string) => {
  const token = `(?<![a-z0-9])${escapeRegex(skill.toLowerCase())}(?![a-z0-9])`;
  return new RegExp(`${minorMarker}.{0,45}${token}|${token}.{0,45}${minorMarker}`, "i").test(description);
};

/** Data-driven replacement for the hard-coded backend + PHP/Laravel tier checks. */
export function matchRubric(job: NormalizedJob, rubric: Rubric) {
  const title = job.title.toLowerCase();
  const description = job.description.toLowerCase();
  const text = `${title} ${description}`;
  const roleMatch = rubric.roleFamilies.some((family) => family.titlePatterns.some((pattern) => pattern.trim() !== "" && title.includes(pattern.toLowerCase())));
  const coreMatch = rubric.mustHaveSkills.every((skill) => mentions(text, skill) && !isMinor(description, skill));
  return { roleMatch, coreMatch };
}
