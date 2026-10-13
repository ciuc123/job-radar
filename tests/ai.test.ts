import test from "node:test";
import assert from "node:assert/strict";
import { buildFitRequest, costUsdMicros, fitAnalysisSchema } from "@/lib/ai/claude";
import { realisticJobs } from "@/lib/demo-jobs";
import { defaultProfile } from "@/lib/profile";

test("cost is computed in micro-dollars from per-model prices and unknown models report null", () => {
  const usage = { inputTokens: 1_000, outputTokens: 500, cacheReadTokens: 2_000, cacheWriteTokens: 0 };
  assert.equal(costUsdMicros("claude-opus-5-5", usage), 1_000 * 4 + 500 * 20 + 2_000 * 0.2);
  assert.equal(costUsdMicros("claude-haiku-5-5", { ...usage, cacheReadTokens: 0, cacheWriteTokens: 1_000 }), Math.round(100 + 250 + 125));
  assert.equal(costUsdMicros("some-unknown-model", usage), null);
});

test("fit request keeps the cacheable profile prefix stable and sends only listing fields", () => {
  const db = { ...realisticJobs[0], id: "internal-id", rawData: { secret: "raw feed payload" }, contentHash: "abc" };
  const first = buildFitRequest(defaultProfile, db, 80);
  const second = buildFitRequest(defaultProfile, realisticJobs[1], 60);
  assert.deepEqual(first.system, second.system);
  assert.ok(first.system[1].cache_control);
  const content = first.messages[0].content;
  assert.match(content, /<job_listing>/);
  assert.doesNotMatch(content, /raw feed payload|internal-id|contentHash/);
  assert.doesNotMatch(first.system[1].text, /scoreWeights|thresholds/);
  assert.match(content, /"salary": "not stated"/);
});

test("analysis schema rejects out-of-range scores and unknown recommendations", () => {
  const valid = { score: 80, recommendation: "APPLY", estimated_fit: "good", summary: "s", matches: [], gaps: [], concerns: [], talking_points: [] };
  assert.ok(fitAnalysisSchema.safeParse(valid).success);
  assert.ok(!fitAnalysisSchema.safeParse({ ...valid, score: 140 }).success);
  assert.ok(!fitAnalysisSchema.safeParse({ ...valid, recommendation: "MUST_APPLY" }).success);
});
