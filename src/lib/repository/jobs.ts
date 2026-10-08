import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidateProfiles, jobs, sourceListings, userJobScores, users } from "@/db/schema";
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

export const sampleJobs: DashboardJob[] = deduplicateJobs(realisticJobs).map((group, index) => {
  const scored = scoreJob(group.canonical);
  return {
    ...scored,
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

function normalizedStoredJob(job: typeof jobs.$inferSelect): NormalizedJob {
  return { source: "stored", url: job.canonicalUrl, title: job.title, company: job.company, description: job.description, location: job.location, countries: job.countries, timezoneRequirements: job.timezoneRequirements, employmentType: job.employmentType, contractType: job.contractType, salaryMin: job.salaryMin ?? undefined, salaryMax: job.salaryMax ?? undefined, salaryCurrency: job.salaryCurrency ?? undefined, salaryPeriod: job.salaryPeriod ?? undefined, technologies: job.technologies, seniority: job.seniority, postedAt: job.postedAt?.toISOString(), expiresAt: job.expiresAt?.toISOString(), remoteType: job.remoteType, rawData: job.rawData };
}

export async function rescoreJobs(profile?: ScoringProfile, userId?: string) {
  if (!db) return 0;
  const targetUsers = userId ? [{ id: userId, profile: profile ?? await getScoringProfile(userId) }] : await Promise.all((await db.select({ id: users.id }).from(users)).map(async (user) => ({ id: user.id, profile: await getScoringProfile(user.id) })));
  const rows = await db.select().from(jobs);
  for (const user of targetUsers) for (const job of rows) {
    const scored = scoreJob(normalizedStoredJob(job), user.profile);
    await db.insert(userJobScores).values({ userId: user.id, jobId: job.id, score: scored.score, scoreBreakdown: scored.scoreBreakdown, recommendation: scored.recommendation, updatedAt: new Date() }).onConflictDoUpdate({ target: [userJobScores.userId, userJobScores.jobId], set: { score: scored.score, scoreBreakdown: scored.scoreBreakdown, recommendation: scored.recommendation, updatedAt: new Date() } });
  }
  return rows.length * targetUsers.length;
}

export async function getDashboardJobs(userId?: string): Promise<DashboardJob[]> {
  if (!db) return sampleJobs;
  if (!userId) return [];
  await ensureUserScores(userId);
  const rows = await db.select({ job: jobs, application: applications, match: userJobScores })
    .from(jobs)
    .innerJoin(userJobScores, and(eq(userJobScores.jobId, jobs.id), eq(userJobScores.userId, userId)))
    .leftJoin(applications, and(eq(applications.jobId, jobs.id), eq(applications.userId, userId)))
    .orderBy(desc(userJobScores.score), desc(jobs.discoveredAt));
  if (!rows.length) return [];
  const links = await db.select().from(sourceListings).orderBy(asc(sourceListings.source));
  return rows.map(({ job, application, match }) => ({
    source: links.find((link) => link.jobId === job.id)?.source ?? "unknown",
    sourceJobId: undefined, url: job.canonicalUrl, title: job.title, company: job.company,
    description: job.description, location: job.location, countries: job.countries,
    timezoneRequirements: job.timezoneRequirements, employmentType: job.employmentType,
    contractType: job.contractType, salaryMin: job.salaryMin ?? undefined, salaryMax: job.salaryMax ?? undefined,
    salaryCurrency: job.salaryCurrency ?? undefined, salaryPeriod: job.salaryPeriod ?? undefined,
    technologies: job.technologies, seniority: job.seniority, postedAt: job.postedAt?.toISOString(),
    expiresAt: job.expiresAt?.toISOString(), remoteType: job.remoteType, rawData: job.rawData,
    score: match.score, scoreBreakdown: match.scoreBreakdown, recommendation: match.recommendation,
    id: job.id, discoveredAt: job.discoveredAt.toISOString(), status: application?.status ?? "NEW",
    notes: application?.notes ?? "", sources: links.filter((link) => link.jobId === job.id).map((link) => ({ source: link.source, url: link.url })),
  }));
}

async function ensureUserScores(userId: string) {
  if (!db) return;
  const existing = new Set((await db.select({ jobId: userJobScores.jobId }).from(userJobScores).where(eq(userJobScores.userId, userId))).map((item) => item.jobId));
  const missing = (await db.select().from(jobs)).filter((job) => !existing.has(job.id));
  if (!missing.length) return;
  const profile = await getScoringProfile(userId);
  for (const job of missing) {
    const scored = scoreJob(normalizedStoredJob(job), profile);
    await db.insert(userJobScores).values({ userId, jobId: job.id, score: scored.score, scoreBreakdown: scored.scoreBreakdown, recommendation: scored.recommendation }).onConflictDoNothing();
  }
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
      await db.update(jobs).set({ updatedAt: new Date() }).where(eq(jobs.id, jobId));
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
    const candidateUsers = await db.select({ id: users.id }).from(users);
    for (const candidate of candidateUsers) {
      const candidateProfile = await getScoringProfile(candidate.id);
      const match = scoreJob(raw, candidateProfile);
      await db.insert(userJobScores).values({ userId: candidate.id, jobId, score: match.score, scoreBreakdown: match.scoreBreakdown, recommendation: match.recommendation }).onConflictDoUpdate({ target: [userJobScores.userId, userJobScores.jobId], set: { score: match.score, scoreBreakdown: match.scoreBreakdown, recommendation: match.recommendation, updatedAt: new Date() } });
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
