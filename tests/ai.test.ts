import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDraft, type ProfileDraft } from "@/lib/ai/profile-draft";
import { estimateCostMicroUsd } from "@/lib/ai/usage";
import { blendScores } from "@/lib/scoring/blend";
import { profileHash } from "@/lib/ai/profile-hash";
import { runPool } from "@/lib/ai/pool";
import { validateSuggestions } from "@/lib/ai/score-explainer";
import { defaultProfile } from "@/lib/profile";
import { buildFitPrompt, clampScore, fitAnalysisSchema } from "@/lib/ai/fit";
import { realisticJobs } from "@/lib/demo-jobs";

const draft = (overrides: Partial<ProfileDraft> = {}): ProfileDraft => ({
  headline: " Senior Python developer ", experienceYears: 9, experienceSummary: "Nine years of Python.",
  preferredTitles: ["Senior Python Developer", "Lead Django Engineer"],
  strongSkills: ["Python", "Django", "python", "PostgreSQL"], secondarySkills: ["Docker", "Django"],
  preferredLocations: ["Europe"], excludedLocations: [], preferredEmploymentTypes: ["contract"], negativeSignals: ["junior"],
  salaryMinimum: 60000.4,
  roleFamilies: [{ name: "Python backend", titlePatterns: [" Python ", "Django", ""] }],
  mustHaveSkills: ["Python", "Rust", "Django", "PostgreSQL", "Docker"],
  skillWeights: [{ skill: "python", weight: 400 }, { skill: "Unlisted", weight: 5 }, { skill: "Docker", weight: Number.NaN }],
  strongRequiresFullRemote: true, strongRequiresSalary: false, rationale: "  Because.  ", ...overrides,
});

test("normalizeDraft dedupes, trims and bounds model output", () => {
  const { profile, rationale } = normalizeDraft(draft());
  assert.equal(profile.headline, "Senior Python developer");
  assert.deepEqual(profile.strongSkills, ["Python", "Django", "PostgreSQL"]);
  assert.deepEqual(profile.secondarySkills, ["Docker"]);
  assert.equal(profile.salaryMinimum, 60000);
  assert.deepEqual(profile.scoreWeights, { Python: 50 });
  assert.deepEqual(profile.rubric?.roleFamilies, [{ name: "Python backend", titlePatterns: ["python", "django"] }]);
  assert.deepEqual(profile.rubric?.mustHaveSkills, ["Python", "Django", "PostgreSQL"]);
  assert.equal(rationale, "Because.");
  assert.deepEqual(profile.thresholds, defaultProfile.thresholds);
});

test("normalizeDraft derives role families from titles and drops a rubric it cannot build", () => {
  const derived = normalizeDraft(draft({ roleFamilies: [] })).profile.rubric;
  assert.deepEqual(derived?.roleFamilies[0].titlePatterns, ["python developer", "django engineer"]);
  assert.equal(normalizeDraft(draft({ roleFamilies: [], preferredTitles: [] })).profile.rubric, null);
});

test("normalizeDraft rejects invalid numbers", () => {
  const { profile } = normalizeDraft(draft({ experienceYears: Number.NaN, salaryMinimum: -5 }));
  assert.equal(profile.experienceYears, 0);
  assert.equal(profile.salaryMinimum, null);
});

test("cost estimate uses model prices and prices unknown models at the highest rate", () => {
  assert.equal(estimateCostMicroUsd("claude-haiku-5-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 }), 600_000);
  assert.equal(estimateCostMicroUsd("claude-sonnet-5-5", { inputTokens: 4000, outputTokens: 6000 }), 68_000);
  assert.equal(estimateCostMicroUsd("claude-typo", { inputTokens: 0, outputTokens: 1000 }), estimateCostMicroUsd("claude-opus-5-5", { inputTokens: 0, outputTokens: 1000 }));
});

test("cost estimate prices Opus 5.5 and counts cache reads and writes", () => {
  const usage = { inputTokens: 1_000, outputTokens: 500, cacheReadTokens: 2_000, cacheWriteTokens: 0 };
  // Cache reads are billed at 0.1x input (conservative for Opus, whose list rate is lower).
  assert.equal(estimateCostMicroUsd("claude-opus-5-5", usage), Math.ceil((1_000 + 2_000 * 0.1) * 4 + 500 * 20));
  assert.equal(estimateCostMicroUsd("claude-haiku-5-5", { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000 }), Math.ceil(1_000 * 1.25 * 0.1));
});

test("fit prompt keeps the cacheable profile prefix stable and sends only listing fields", () => {
  const row = { ...realisticJobs[0], id: "internal-id", rawData: { secret: "raw feed payload" }, contentHash: "abc" };
  const first = buildFitPrompt(defaultProfile, row, 80);
  const second = buildFitPrompt(defaultProfile, realisticJobs[1], 60);
  assert.equal(first.system, second.system);
  assert.equal(first.cachedSystem, second.cachedSystem);
  assert.match(first.content, /<job_listing>/);
  assert.doesNotMatch(first.content, /raw feed payload|internal-id|contentHash/);
  assert.doesNotMatch(first.cachedSystem, /scoreWeights|thresholds/);
  assert.match(first.content, /"salary": "not stated"/);
});

test("fit prompt truncates very long descriptions", () => {
  const prompt = buildFitPrompt(defaultProfile, { ...realisticJobs[0], description: "x".repeat(20_000) }, 70);
  assert.ok(prompt.content.length < 8_000);
});

test("fit schema rejects unknown recommendations and clampScore bounds the model's score", () => {
  const valid = { score: 80, recommendation: "APPLY", estimated_fit: "good", summary: "s", matches: [], gaps: [], concerns: [], talking_points: [] };
  assert.ok(fitAnalysisSchema.safeParse(valid).success);
  assert.ok(!fitAnalysisSchema.safeParse({ ...valid, recommendation: "MUST_APPLY" }).success);
  assert.equal(clampScore(140), 100);
  assert.equal(clampScore(-3), 0);
  assert.equal(clampScore(71.6), 72);
});

test("blendScores is a no-op at weight 0 and without an AI score, and stays in range", () => {
  assert.equal(blendScores(70, 90, 0), 70);
  assert.equal(blendScores(70, null, 0.5), 70);
  assert.equal(blendScores(70, 90, 0.5), 80);
  assert.equal(blendScores(70, 90, 5), 90);
  assert.equal(blendScores(70, 1000, 1), 100);
});

test("profileHash ignores key order and changes with scoring-relevant edits", () => {
  const reordered = Object.fromEntries(Object.entries(defaultProfile).reverse()) as typeof defaultProfile;
  assert.equal(profileHash(defaultProfile), profileHash(reordered));
  assert.notEqual(profileHash(defaultProfile), profileHash({ ...defaultProfile, scoreWeights: { PHP: 5 } }));
  assert.notEqual(profileHash(defaultProfile), profileHash({ ...defaultProfile, salaryMinimum: 10 }));
});

test("runPool respects its concurrency limit and processes every item", async () => {
  let active = 0; let peak = 0; const seen: number[] = [];
  await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (item) => { active++; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 5)); seen.push(item); active--; });
  assert.equal(peak, 3);
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5, 6, 7]);
  await runPool([], 3, async () => { throw new Error("never called"); });
});

test("validateSuggestions keeps only known skills, bounds weights and removes duplicates", () => {
  const profile = { ...defaultProfile, scoreWeights: { Laravel: 10 } };
  const result = validateSuggestions([
    { weightKey: "laravel", suggestedWeight: 99, reason: "a" },
    { weightKey: "Laravel", suggestedWeight: 5, reason: "dup" },
    { weightKey: "tier.core_stack", suggestedWeight: 5, reason: "not tunable" },
    { weightKey: "React", suggestedWeight: Number.NaN, reason: "bad number" },
    { weightKey: "React", suggestedWeight: 4.6, reason: "ok" },
  ], profile);
  assert.deepEqual(result.map((item) => [item.weightKey, item.current, item.suggested]), [["Laravel", 10, 50], ["React", null, 5]]);
});
