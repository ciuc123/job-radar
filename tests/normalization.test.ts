import test from "node:test";
import assert from "node:assert/strict";
import { cleanHtml, contentHash, normalizeJob, normalizeUrl, parseSalary } from "@/lib/jobs/normalize";
import { deduplicateJobs } from "@/lib/deduplication/deduplicator";
import { realisticJobs, job } from "@/lib/demo-jobs";
import { mapHimalayasJob } from "@/lib/sources/himalayas";
import { runSourcesIndependently } from "@/lib/sources/pipeline";
import { mapWwrFeed } from "@/lib/sources/wwr";
import { mapJobgetherListing } from "@/lib/sources/jobgether";

test("normalizes HTML, URL tracking parameters, whitespace, and technology signals", () => {
  const normalized = normalizeJob(job({ url: "https://WWW.Example.com/role/?utm_source=board#apply", title: "  Senior  Laravel Developer ", description: "<p>PHP &amp; MySQL</p>" }));
  assert.equal(normalized.url, "https://example.com/role");
  assert.equal(normalized.title, "Senior Laravel Developer");
  assert.equal(normalized.description, "PHP & MySQL");
  assert.ok(normalized.technologies.includes("PHP"));
});

test("parses salary ranges, currency, period, and missing salary", () => {
  assert.deepEqual(parseSalary("€60–90/h"), { min: 60, max: 90, currency: "EUR", period: "hourly" });
  assert.deepEqual(parseSalary("USD 120k - 150k annually"), { min: 120000, max: 150000, currency: "USD", period: "annual" });
  assert.deepEqual(parseSalary(undefined), {});
});

test("canonicalizes duplicate URL tracking and groups same-company normalized titles across sources", () => {
  const groups = deduplicateJobs(realisticJobs.slice(23));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].listings.length, 2);
});

test("deduplication recognizes source IDs, canonical URLs, and long identical descriptions", () => {
  const longDescription = "Design and operate distributed backend services with reliable APIs, clear ownership, comprehensive monitoring, and a collaborative team working across several European countries.";
  const bySourceId = deduplicateJobs([job({ source: "himalayas", sourceJobId: "abc", title: "Role A" }), job({ source: "himalayas", sourceJobId: "abc", title: "Renamed role", url: "https://other.test/role" })]);
  const byCanonicalUrl = deduplicateJobs([job({ company: "One", title: "Role A", url: "https://example.test/job/1?utm_source=a" }), job({ company: "Other", title: "Role B", url: "https://example.test/job/1?utm_source=b" })]);
  const byBody = deduplicateJobs([job({ title: "Senior PHP Engineer", company: "One", description: longDescription }), job({ title: "Senior Backend Engineer", company: "Other", description: longDescription })]);
  assert.equal(bySourceId.length, 1);
  assert.equal(byCanonicalUrl.length, 1);
  assert.equal(byBody.length, 1);
});

test("content hashes are stable after markup and whitespace cleanup", () => {
  assert.equal(contentHash(job({ description: "PHP <b>Laravel</b>" })), contentHash(job({ description: " PHP Laravel " })));
});

test("the realistic ranking fixture covers at least twenty distinct scenarios", () => {
  assert.ok(realisticJobs.length >= 20);
  assert.ok(realisticJobs.some((item) => item.salaryMax == null));
  assert.ok(realisticJobs.some((item) => item.employmentType.includes("Internship")));
});

test("maps Himalayas country restrictions, timezone, salary, and source ID", () => {
  const result = mapHimalayasJob({ title: "Senior PHP", companyName: "Acme", applicationLink: "https://himalayas.app/jobs/a", guid: "a", description: "PHP APIs", locationRestrictions: [{ name: "Romania" }], timezoneRestrictions: ["UTC+2"], minSalary: 50, maxSalary: 90, currency: "EUR", salaryPeriod: "hourly" });
  assert.equal(result?.sourceJobId, "a");
  assert.deepEqual(result?.countries, ["Romania"]);
  assert.equal(result?.salaryMax, 90);
});

test("Himalayas normalization safely ignores non-string list values from source payloads", () => {
  const result = mapHimalayasJob({
    title: "Senior PHP Engineer", companyName: "Acme", applicationLink: "https://himalayas.app/jobs/a",
    locationRestrictions: [{ name: 42 } as unknown as { name?: string }, "Romania"],
    timezoneRestrictions: ["UTC+2", 42] as unknown as string[], categories: ["Backend", { name: "PHP" }] as unknown as string[],
  });
  assert.deepEqual(result?.countries, ["Romania"]);
  assert.deepEqual(result?.timezoneRequirements, ["UTC+2"]);
  assert.ok(result?.technologies.includes("PHP"));
});

test("maps Jobgether documented public API results", () => {
  const result = mapJobgetherListing({
    id: "job-1", title: "Senior PHP Backend Engineer", company: "Acme", url: "https://jobgether.com/offer/php-backend",
    location: ["Romania", "Europe"], remote: "Full Remote", contractType: "Freelance", experience: "Senior (5-10 years)",
    salaryRange: "60000-80000 EUR", jobFunctions: ["Backend Developer"], postedAt: "2026-10-07T00:00:00Z",
  });
  assert.equal(result?.sourceJobId, "job-1");
  assert.equal(result?.salaryMin, 60000);
  assert.deepEqual(result?.countries, ["Romania", "Europe"]);
  assert.equal(result?.contractType[0], "Freelance");
});

test("maps official We Work Remotely RSS listings and rejects malformed feeds", () => {
  const jobs = mapWwrFeed(`<rss version="2.0"><channel><item><title>Acme: Senior PHP Engineer</title><link>https://weworkremotely.com/remote-jobs/acme-php</link><guid>job-1</guid><description>Build PHP APIs remotely.</description><pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate><category>PHP</category></item></channel></rss>`);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, "Acme");
  assert.equal(jobs[0].title, "Senior PHP Engineer");
  assert.equal(jobs[0].sourceJobId, "job-1");
  assert.throws(() => mapWwrFeed("<html>blocked</html>"), /invalid RSS/);
});

test("source failures are isolated and later sources still run", async () => {
  let secondSourceRan = false;
  const sources = [
    { id: "down", name: "Down", enabled: true, available: true, fetch: async () => ({ source: "down", jobs: [] }) },
    { id: "up", name: "Up", enabled: true, available: true, fetch: async () => ({ source: "up", jobs: [] }) },
  ];
  const results = await runSourcesIndependently(sources, async (source) => {
    if (source.id === "down") throw new Error("temporary failure");
    secondSourceRan = true;
    return { discovered: 3, added: 2, duplicates: 1 };
  });
  assert.equal(results[0].ok, false);
  assert.equal(results[1].ok, true);
  assert.equal(secondSourceRan, true);
});
