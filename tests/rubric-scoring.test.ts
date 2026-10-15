import test from "node:test";
import assert from "node:assert/strict";
import { scoreJob } from "@/lib/scoring/scorer";
import { defaultProfile } from "@/lib/profile";
import { job } from "@/lib/demo-jobs";
import type { ScoringProfile } from "@/lib/types";

const pythonProfile: ScoringProfile = {
  ...defaultProfile,
  headline: "Senior Python developer", preferredTitles: ["Senior Python Developer"],
  strongSkills: ["Python", "Django", "PostgreSQL"], secondarySkills: ["Docker"],
  scoreWeights: { Python: 20, Django: 20 }, salaryMinimum: 60,
  rubric: { roleFamilies: [{ name: "Python backend", titlePatterns: ["python", "django"] }], mustHaveSkills: ["Python", "Django"], strongRequiresFullRemote: true, strongRequiresSalary: true },
};
const base = { title: "Senior Python Developer", description: "Build Django services with Python as the core stack on PostgreSQL.", technologies: ["Python", "Django"] };

test("rubric defines the pipeline, review and strong tiers for a non-PHP profile", () => {
  const strong = scoreJob(job({ ...base, remoteType: "Full Remote", salaryMin: 80, salaryMax: 100 }), pythonProfile);
  const review = scoreJob(job({ ...base, remoteType: "Hybrid" }), pythonProfile);
  const roleOnly = scoreJob(job({ ...base, description: "Build services in Python." }), pythonProfile);
  const laravel = scoreJob(job({ title: "Senior Laravel Developer", description: "Laravel and PHP core stack.", technologies: ["PHP", "Laravel"] }), pythonProfile);
  assert.equal(strong.recommendation, "APPLY");
  assert.equal(review.recommendation, "REVIEW");
  assert.equal(roleOnly.recommendation, "MAYBE");
  assert.ok(laravel.score < pythonProfile.thresholds.maybe);
  assert.ok(strong.scoreBreakdown["tier.core_stack"] > 0 && strong.scoreBreakdown["role.family"] > 0);
  assert.equal(strong.scoreBreakdown["tier.php_laravel_backend"], undefined);
});

test("rubric flags relax or tighten the strong tier", () => {
  const hybridHighPay = job({ ...base, remoteType: "Hybrid", salaryMin: 80, salaryMax: 100 });
  const relaxed = { ...pythonProfile, rubric: { ...pythonProfile.rubric!, strongRequiresFullRemote: false } };
  assert.equal(scoreJob(hybridHighPay, pythonProfile).recommendation, "REVIEW");
  assert.equal(scoreJob(hybridHighPay, relaxed).recommendation, "APPLY");
});

test("a must-have skill marked minor or optional does not earn the review tier", () => {
  const minor = scoreJob(job({ ...base, description: "Backend services. Django experience is a nice to have; Python is used for scripts." }), pythonProfile);
  assert.equal(minor.recommendation, "MAYBE");
});

test("profiles without a rubric keep the legacy PHP/Laravel tiers", () => {
  const legacy = scoreJob(job({ title: "Senior Laravel Backend Engineer", description: "Build backend APIs with PHP and Laravel as the core stack." }), { ...defaultProfile, rubric: null });
  assert.equal(legacy.recommendation, "REVIEW");
  assert.ok(legacy.scoreBreakdown["tier.php_laravel_backend"] > 0);
});
