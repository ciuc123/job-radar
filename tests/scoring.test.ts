import test from "node:test";
import assert from "node:assert/strict";
import { scoreJob, recommendationFor } from "@/lib/scoring/scorer";
import { defaultProfile } from "@/lib/profile";
import { realisticJobs, job } from "@/lib/demo-jobs";

test("scores strong Laravel/PHP contract matches above Java-only and location-ineligible roles", () => {
  const strong = scoreJob(realisticJobs[0]);
  const java = scoreJob(realisticJobs[5]);
  const usOnly = scoreJob(realisticJobs[7]);
  assert.ok(strong.score > java.score);
  assert.ok(strong.score > usOnly.score);
  assert.ok(strong.score >= 70);
  assert.ok(java.score < 50);
});

test("junior, internship, legacy PHP, onsite, and relocation are penalized", () => {
  const senior = scoreJob(realisticJobs[0]).score;
  for (const index of [6, 12, 13, 14, 18]) assert.ok(scoreJob(realisticJobs[index]).score < senior);
  assert.ok(scoreJob(realisticJobs[6]).scoreBreakdown["negative.junior"] < 0);
  assert.ok(scoreJob(realisticJobs[14]).scoreBreakdown["negative.internship"] < 0);
});

test("role and location matching use text context and stay bounded", () => {
  const latam = scoreJob(job({ location: "Remote Latin America", countries: ["Brazil"] }));
  const europe = scoreJob(realisticJobs[0]);
  assert.ok(europe.score > latam.score);
  assert.ok(scoreJob(job({ description: "A".repeat(1000), technologies: [] })).score <= 100);
  assert.ok(scoreJob(job({ location: "US only", countries: ["United States"] })).scoreBreakdown["negative.location.us_only"] < 0);
});

test("thresholds are configurable and map exactly to recommendations", () => {
  assert.equal(recommendationFor(85), "APPLY");
  assert.equal(recommendationFor(70), "REVIEW");
  assert.equal(recommendationFor(50), "MAYBE");
  assert.equal(recommendationFor(49), "REJECT");
  assert.equal(recommendationFor(80, { apply: 90, review: 75, maybe: 60 }), "REVIEW");
});

test("minimum salary preference penalizes below-minimum roles", () => {
  const profile = { ...defaultProfile, salaryMinimum: 40 };
  assert.ok(scoreJob(realisticJobs[21], profile).score < scoreJob(realisticJobs[22], profile).score);
});

test("weight overrides and preferred location edits change rankings", () => {
  const defaultScore = scoreJob(realisticJobs[0]).score;
  const weightedScore = scoreJob(realisticJobs[0], { ...defaultProfile, scoreWeights: { Laravel: 5 } }).score;
  const noEuropeBonus = scoreJob(realisticJobs[0], { ...defaultProfile, preferredLocations: ["Worldwide"] }).score;
  assert.ok(weightedScore < defaultScore);
  assert.ok(noEuropeBonus < defaultScore);
});
