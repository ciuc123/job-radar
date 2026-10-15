import { loadEnvConfig } from "@next/env";
import { aiConfig } from "@/lib/ai/config";
import { analyzeJobFit } from "@/lib/ai/fit";
import { PROMPT_VERSION } from "@/lib/ai/prompt";
import { realisticJobs } from "@/lib/demo-jobs";
import { defaultProfile } from "@/lib/profile";
import { scoreJob } from "@/lib/scoring/scorer";

// Small labeled eval over the public demo fixtures and the default profile (never private /network data).
// Each case lists the recommendations a careful human reviewer would accept.
const cases: Array<{ index: number; accept: string[]; why: string }> = [
  { index: 0, accept: ["APPLY", "REVIEW"], why: "Laravel/PHP senior contract, remote Europe" },
  { index: 4, accept: ["APPLY", "REVIEW"], why: "Staff backend Laravel, CET remote contract" },
  { index: 9, accept: ["APPLY", "REVIEW"], why: "PHP/Laravel, remote worldwide" },
  { index: 10, accept: ["APPLY", "REVIEW"], why: "PHP contract, Laravel preferred, remote Romania" },
  { index: 15, accept: ["APPLY", "REVIEW", "MAYBE"], why: "Symfony/PHP European team" },
  { index: 5, accept: ["REJECT", "MAYBE"], why: "Java-only, no PHP" },
  { index: 6, accept: ["REJECT"], why: "Junior role" },
  { index: 7, accept: ["REJECT"], why: "US-only eligibility" },
  { index: 8, accept: ["REJECT"], why: "On-site London five days a week" },
  { index: 12, accept: ["REJECT", "MAYBE"], why: "Legacy PHP maintenance, mostly Java" },
  { index: 13, accept: ["REJECT"], why: "Graduate program, on-site" },
  { index: 14, accept: ["REJECT"], why: "Internship" },
  { index: 18, accept: ["REJECT"], why: "Relocation to the US required" },
  { index: 19, accept: ["REJECT"], why: "India-only" },
  { index: 20, accept: ["REJECT"], why: "Canada-only" },
];

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required (set it in .env.local).");
  console.info(`Model ${aiConfig.analysisModel} · prompt ${PROMPT_VERSION} · ${cases.length} cases\n`);
  let passed = 0;
  let cost = 0;
  let cacheReads = 0;
  for (const testCase of cases) {
    const job = realisticJobs[testCase.index];
    const started = Date.now();
    try {
      const { analysis, costMicroUsd, usage } = await analyzeJobFit(null, defaultProfile, job, scoreJob(job).score, { model: aiConfig.analysisModel });
      const ok = testCase.accept.includes(analysis.recommendation);
      if (ok) passed++;
      cost += costMicroUsd;
      cacheReads += usage.cacheReadTokens;
      console.info(`${ok ? "PASS" : "FAIL"}  #${String(testCase.index).padEnd(2)} ${job.title.slice(0, 34).padEnd(34)} got ${analysis.recommendation.padEnd(6)} (${String(analysis.score).padStart(3)}) want ${testCase.accept.join("|").padEnd(18)} ${Date.now() - started}ms  ${testCase.why}`);
    } catch (error) {
      console.info(`ERROR #${testCase.index} ${job.title}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.info(`\nAgreement: ${passed}/${cases.length} (${Math.round((passed / cases.length) * 100)}%) · cost ≈ $${(cost / 1_000_000).toFixed(4)} · cache-read tokens ${cacheReads}`);
  if (passed < cases.length) process.exitCode = 1;
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
