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
  assert.ok(java.score < defaultProfile.thresholds.review);
  assert.equal(java.recommendation, "MAYBE");
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
  const lowPay = scoreJob(realisticJobs[21], profile);
  const noSalary = scoreJob(realisticJobs[22], profile);
  assert.ok(lowPay.scoreBreakdown["negative.salary_below_minimum"] < 0);
  assert.equal(noSalary.scoreBreakdown["negative.salary_below_minimum"], undefined);
});

test("pipeline, review, and strong-match tiers follow the requested backend criteria", () => {
  const backendOnly = scoreJob(job({
    title: "Senior Backend Engineer", description: "Build backend services in Java.", technologies: ["Java"],
  }));
  const phpLaravel = scoreJob(job({
    title: "Senior Laravel Backend Engineer", description: "Build backend APIs with PHP and Laravel as the core stack.",
  }));
  const strong = scoreJob(job({
    title: "Senior Laravel Backend Engineer", description: "Build backend APIs with PHP and Laravel as the core stack.",
    salaryMin: 70, salaryMax: 90, salaryCurrency: "EUR", salaryPeriod: "hourly", remoteType: "Full Remote",
  }), { ...defaultProfile, salaryMinimum: 60 });

  assert.equal(backendOnly.recommendation, "MAYBE");
  assert.ok(backendOnly.score >= defaultProfile.thresholds.maybe && backendOnly.score < defaultProfile.thresholds.review);
  assert.equal(phpLaravel.recommendation, "REVIEW");
  assert.ok(phpLaravel.score >= defaultProfile.thresholds.review && phpLaravel.score < defaultProfile.thresholds.apply);
  assert.equal(strong.recommendation, "APPLY");
  assert.ok(strong.score >= defaultProfile.thresholds.apply);
});

test("missing salary floor, low salary, hybrid work, and hard negative signals prevent strong tier", () => {
  const role = { title: "Senior Laravel Backend Engineer", description: "Build backend APIs with PHP and Laravel as the core stack." };
  const profile = { ...defaultProfile, salaryMinimum: 60 };
  const lowPay = scoreJob(job({ ...role, salaryMin: 30, salaryMax: 50, remoteType: "Remote" }), profile);
  const hybrid = scoreJob(job({ ...role, salaryMin: 70, salaryMax: 90, remoteType: "Hybrid" }), profile);
  const noConfiguredFloor = scoreJob(job({ ...role, salaryMin: 70, salaryMax: 90, remoteType: "Remote" }));
  const junior = scoreJob(job({ ...role, title: "Junior Laravel Backend Engineer", salaryMin: 70, salaryMax: 90, remoteType: "Remote" }), profile);
  assert.equal(lowPay.recommendation, "REVIEW");
  assert.equal(hybrid.recommendation, "REVIEW");
  assert.equal(noConfiguredFloor.recommendation, "REVIEW");
  assert.equal(junior.recommendation, "MAYBE");
});

test("weight overrides and preferred location edits change rankings", () => {
  const defaultScore = scoreJob(realisticJobs[0]).score;
  const weightedScore = scoreJob(realisticJobs[0], { ...defaultProfile, scoreWeights: { Laravel: 5 } }).score;
  const noEuropeBonus = scoreJob(realisticJobs[0], { ...defaultProfile, preferredLocations: ["Worldwide"] }).score;
  assert.ok(weightedScore < defaultScore);
  assert.ok(noEuropeBonus < defaultScore);
});
