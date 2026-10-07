import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidateProfiles, jobs, sourceListings } from "@/db/schema";
import { defaultProfile } from "@/lib/profile";
import { realisticJobs } from "@/lib/demo-jobs";
import { deduplicateJobs } from "@/lib/deduplication/deduplicator";
import { contentHash } from "@/lib/jobs/normalize";
import { scoreJob } from "@/lib/scoring/scorer";
import type { JobStatus, NormalizedJob, ScoredJob, ScoringProfile } from "@/lib/types";

export type DashboardJob = ScoredJob & {
  id: string;
  discoveredAt: string;
  status: JobStatus;
  sources: Array<{ source: string; url: string }>;
  notes?: string;
};

export const hasDatabase = () => Boolean(db);

const demoScore = new Map<number, number>([[0, 94], [1, 89], [2, 84], [3, 72], [5, 48], [6, 25], [7, 10]]);

export const sampleJobs: DashboardJob[] = deduplicateJobs(realisticJobs).map((group, index) => {
  const scored = scoreJob(group.canonical);
  const score = demoScore.get(index) ?? scored.score;
  return {
    ...scored,
    score,
    recommendation: score >= 85 ? "APPLY" : score >= 70 ? "REVIEW" : score >= 50 ? "MAYBE" : "REJECT",
    scoreBreakdown: { ...scored.scoreBreakdown, ...(demoScore.has(index) ? { "sample.preview_score": score } : {}) },
    id: `demo-${index + 1}`,
    discoveredAt: new Date(Date.now() - index * 3_600_000).toISOString(),
    status: "NEW",
    sources: group.listings.map((item) => ({ source: item.source, url: item.url })),
  };
});

export async function getScoringProfile(userId?: string): Promise<ScoringProfile> {
  if (!db) return defaultProfile;
  const rows = userId
    ? await db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, userId)).limit(1)
    : await db.select().from(candidateProfiles).limit(1);
  if (!rows[0]) return defaultProfile;
  const profile = rows[0];
  return {
    headline: profile.headline, experienceYears: profile.experienceYears, experienceSummary: profile.experienceSummary,
    preferredTitles: profile.preferredTitles,
    strongSkills: profile.strongSkills, secondarySkills: profile.secondarySkills,
    preferredLocations: profile.preferredLocations, excludedLocations: profile.excludedLocations,
    preferredEmploymentTypes: profile.preferredEmploymentTypes, negativeSignals: profile.negativeSignals, salaryMinimum: profile.salaryMinimum,
    thresholds: profile.thresholds, scoreWeights: profile.scoreWeights,
  };
}

export async function rescoreJobs(profile: ScoringProfile) {
  if (!db) return;
  const rows = await db.select().from(jobs);
  for (const job of rows) {
    const scored = scoreJob({
      source: "stored", sourceJobId: undefined, url: job.canonicalUrl, title: job.title, company: job.company,
      description: job.description, location: job.location, countries: job.countries, timezoneRequirements: job.timezoneRequirements,
      employmentType: job.employmentType, contractType: job.contractType, salaryMin: job.salaryMin ?? undefined,
      salaryMax: job.salaryMax ?? undefined, salaryCurrency: job.salaryCurrency ?? undefined, salaryPeriod: job.salaryPeriod ?? undefined,
      technologies: job.technologies, seniority: job.seniority, postedAt: job.postedAt?.toISOString(), expiresAt: job.expiresAt?.toISOString(),
      remoteType: job.remoteType, rawData: job.rawData,
    }, profile);
    await db.update(jobs).set({ score: scored.score, scoreBreakdown: scored.scoreBreakdown, recommendation: scored.recommendation, updatedAt: new Date() }).where(eq(jobs.id, job.id));
  }
}

export async function getDashboardJobs(userId?: string): Promise<DashboardJob[]> {
  if (!db) return sampleJobs;
  const rows = await db.select({ job: jobs, application: applications })
    .from(jobs)
    .leftJoin(applications, userId ? and(eq(applications.jobId, jobs.id), eq(applications.userId, userId)) : eq(applications.jobId, jobs.id))
    .orderBy(desc(jobs.score), desc(jobs.discoveredAt));
  if (!rows.length) return [];
  const links = await db.select().from(sourceListings).orderBy(asc(sourceListings.source));
  return rows.map(({ job, application }) => ({
    source: links.find((link) => link.jobId === job.id)?.source ?? "unknown",
    sourceJobId: undefined, url: job.canonicalUrl, title: job.title, company: job.company,
    description: job.description, location: job.location, countries: job.countries,
    timezoneRequirements: job.timezoneRequirements, employmentType: job.employmentType,
    contractType: job.contractType, salaryMin: job.salaryMin ?? undefined, salaryMax: job.salaryMax ?? undefined,
    salaryCurrency: job.salaryCurrency ?? undefined, salaryPeriod: job.salaryPeriod ?? undefined,
    technologies: job.technologies, seniority: job.seniority, postedAt: job.postedAt?.toISOString(),
    expiresAt: job.expiresAt?.toISOString(), remoteType: job.remoteType, rawData: job.rawData,
    score: job.score, scoreBreakdown: job.scoreBreakdown, recommendation: job.recommendation,
    id: job.id, discoveredAt: job.discoveredAt.toISOString(), status: application?.status ?? "NEW",
    notes: application?.notes ?? "", sources: links.filter((link) => link.jobId === job.id).map((link) => ({ source: link.source, url: link.url })),
  }));
}

export async function updateJobApplication(userId: string, jobId: string, status: JobStatus, notes?: string) {
  if (!db) throw new Error("Database is not configured");
  const now = new Date();
  await db.insert(applications).values({ userId, jobId, status, notes: notes ?? "", appliedAt: status === "APPLIED" ? now : undefined, updatedAt: now })
    .onConflictDoUpdate({ target: [applications.userId, applications.jobId], set: { status, ...(notes !== undefined ? { notes } : {}), ...(status === "APPLIED" ? { appliedAt: now } : {}), updatedAt: now } });
}

export async function saveProfile(userId: string, input: Awaited<ReturnType<typeof getScoringProfile>>) {
  if (!db) throw new Error("Database is not configured");
  await db.insert(candidateProfiles).values({ userId, ...input, updatedAt: new Date() })
    .onConflictDoUpdate({ target: candidateProfiles.userId, set: { ...input, updatedAt: new Date() } });
}

export async function persistJobs(source: string, normalizedJobs: NormalizedJob[], profile = defaultProfile) {
  if (!db) return { discovered: normalizedJobs.length, added: 0, duplicates: normalizedJobs.length };
  let added = 0;
  let duplicates = 0;
  for (const group of deduplicateJobs(normalizedJobs)) {
    const raw = group.canonical;
    const scored = scoreJob(raw, profile);
    const normalizedTitle = raw.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const normalizedCompany = raw.company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const existing = await db.select().from(jobs).where(or(eq(jobs.canonicalUrl, raw.url), eq(jobs.contentHash, contentHash(raw)), and(sql`lower(${jobs.company}) = ${normalizedCompany}`, sql`lower(${jobs.title}) = ${normalizedTitle}`))).limit(1);
    let jobId: string;
    if (existing[0]) {
      jobId = existing[0].id;
      duplicates++;
      await db.update(jobs).set({ score: scored.score, scoreBreakdown: scored.scoreBreakdown, recommendation: scored.recommendation, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    } else {
      const created = await db.insert(jobs).values({
        canonicalUrl: raw.url, title: raw.title, company: raw.company, description: raw.description, location: raw.location,
        countries: raw.countries, timezoneRequirements: raw.timezoneRequirements, employmentType: raw.employmentType,
        contractType: raw.contractType, salaryMin: raw.salaryMin, salaryMax: raw.salaryMax, salaryCurrency: raw.salaryCurrency,
        salaryPeriod: raw.salaryPeriod, technologies: raw.technologies, seniority: raw.seniority,
        postedAt: raw.postedAt ? new Date(raw.postedAt) : null, expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : null,
        remoteType: raw.remoteType, rawData: raw.rawData, contentHash: contentHash(raw), score: scored.score,
        scoreBreakdown: scored.scoreBreakdown, recommendation: scored.recommendation,
      }).returning({ id: jobs.id });
      jobId = created[0].id;
      added++;
    }
    for (const listing of group.listings) {
      const conflictTarget = listing.sourceJobId ? [sourceListings.source, sourceListings.sourceJobId] : [sourceListings.source, sourceListings.url];
      await db.insert(sourceListings).values({ jobId, source: listing.source || source, sourceJobId: listing.sourceJobId ?? null, url: listing.url, lastSeenAt: new Date() })
        .onConflictDoUpdate({ target: conflictTarget, set: { jobId, url: listing.url, lastSeenAt: new Date() } });
    }
  }
  return { discovered: normalizedJobs.length, added, duplicates };
}

export function demoJob(id: string) { return sampleJobs.find((item) => item.id === id); }
