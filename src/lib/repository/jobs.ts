import { and, asc, desc, eq, getTableColumns, gte, inArray, isNotNull, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidateProfiles, jobs, sourceListings, userJobScores, users } from "@/db/schema";
import { defaultProfile } from "@/lib/profile";
import { realisticJobs } from "@/lib/demo-jobs";
import { deduplicateJobs } from "@/lib/deduplication/deduplicator";
import { contentHash, normalizeJob } from "@/lib/jobs/normalize";
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
  const scored = scoreJob(normalizeJob(group.canonical));
  return {
    ...scored,
    id: `demo-${index + 1}`,
    discoveredAt: new Date(Date.now() - index * 3_600_000).toISOString(),
    status: "NEW",
    sources: group.listings.map((item) => ({ source: item.source, url: item.url })),
  };
});

const SEARCH_TERMS_PER_PROFILE = 3;
const MAX_SEARCH_TERMS = 8;

// Keywords for search-capable sources: each user's first few strong skills (listed most important first),
// de-duplicated case-insensitively across users. Falls back to the default profile.
export async function getSearchTerms(): Promise<string[]> {
  const rows = db ? await db.select({ strongSkills: candidateProfiles.strongSkills }).from(candidateProfiles) : [];
  const lists = rows.length ? rows.map((row) => row.strongSkills) : [defaultProfile.strongSkills];
  const terms = new Map<string, string>();
  for (const list of lists) for (const skill of list.slice(0, SEARCH_TERMS_PER_PROFILE)) {
    const term = skill.trim();
    if (term && !terms.has(term.toLowerCase())) terms.set(term.toLowerCase(), term);
  }
  return [...terms.values()].slice(0, MAX_SEARCH_TERMS);
}

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
    thresholds: profile.thresholds, scoreWeights: profile.scoreWeights, rubric: profile.rubric ?? null,
  };
}

// rawData is the original feed payload: large, and only needed on the job detail page.
// Scoring and list views must not pull it over the wire.
const { rawData: _rawData, ...jobColumnsWithoutRaw } = getTableColumns(jobs);
const { description: _description, ...listJobColumns } = jobColumnsWithoutRaw;
type StoredJob = Omit<typeof jobs.$inferSelect, "rawData">;
const SCORE_BATCH = 250;

function normalizedStoredJob(job: StoredJob): NormalizedJob {
  return { source: "stored", url: job.canonicalUrl, title: job.title, company: job.company, description: job.description, location: job.location, countries: job.countries, hiringRestriction: job.hiringRestriction, timezoneRequirements: job.timezoneRequirements, employmentType: job.employmentType, contractType: job.contractType, salaryMin: job.salaryMin ?? undefined, salaryMax: job.salaryMax ?? undefined, salaryCurrency: job.salaryCurrency ?? undefined, salaryPeriod: job.salaryPeriod ?? undefined, technologies: job.technologies, seniority: job.seniority, postedAt: job.postedAt?.toISOString(), expiresAt: job.expiresAt?.toISOString(), remoteType: job.remoteType, rawData: {} };
}

type ScoreRow = typeof userJobScores.$inferInsert;

// One multi-row statement per batch instead of one HTTP round trip per (user, job).
async function upsertScores(rows: ScoreRow[], { overwrite }: { overwrite: boolean }) {
  if (!db) return;
  for (let index = 0; index < rows.length; index += SCORE_BATCH) {
    const insert = db.insert(userJobScores).values(rows.slice(index, index + SCORE_BATCH));
    if (overwrite) await insert.onConflictDoUpdate({ target: [userJobScores.userId, userJobScores.jobId], set: { score: sql`excluded.score`, scoreBreakdown: sql`excluded.score_breakdown`, recommendation: sql`excluded.recommendation`, updatedAt: sql`now()` } });
    else await insert.onConflictDoNothing();
  }
}

const scoreRow = (userId: string, jobId: string, job: NormalizedJob, profile: ScoringProfile): ScoreRow => {
  const scored = scoreJob(job, profile);
  return { userId, jobId, score: scored.score, scoreBreakdown: scored.scoreBreakdown, recommendation: scored.recommendation };
};

async function scoringUsers() {
  if (!db) return [];
  return Promise.all((await db.select({ id: users.id }).from(users)).map(async (user) => ({ id: user.id, profile: await getScoringProfile(user.id) })));
}

export async function rescoreJobs(profile?: ScoringProfile, userId?: string) {
  if (!db) return 0;
  const targetUsers = userId ? [{ id: userId, profile: profile ?? await getScoringProfile(userId) }] : await scoringUsers();
  const rows = await db.select(jobColumnsWithoutRaw).from(jobs);
  const normalized = rows.map((job) => ({ id: job.id, job: normalizedStoredJob(job) }));
  await upsertScores(targetUsers.flatMap((user) => normalized.map(({ id, job }) => scoreRow(user.id, id, job, user.profile))), { overwrite: true });
  return rows.length * targetUsers.length;
}

type DashboardOptions = { jobId?: string; full?: boolean };
const LIST_DESCRIPTION_CHARS = 1500;
const LIST_MAX_AGE_DAYS = 30;

// List view: descriptions are truncated and rawData is dropped so the page payload stays small.
// Pass `full` (detail page) to get the complete row for a single `jobId`.
export async function getDashboardJobs(userId?: string, { jobId, full = false }: DashboardOptions = {}): Promise<DashboardJob[]> {
  if (!db) return jobId ? sampleJobs.filter((job) => job.id === jobId) : sampleJobs;
  if (!userId) return [];
  await ensureUserScores(userId);
  const rows = await db.select({ job: listJobColumns, rawData: full ? jobs.rawData : sql<null>`null`, application: { status: applications.status, notes: applications.notes }, match: { score: userJobScores.score, scoreBreakdown: userJobScores.scoreBreakdown, recommendation: userJobScores.recommendation }, description: full ? jobs.description : sql<string>`left(${jobs.description}, ${LIST_DESCRIPTION_CHARS})` })
    .from(jobs)
    .innerJoin(userJobScores, and(eq(userJobScores.jobId, jobs.id), eq(userJobScores.userId, userId)))
    .leftJoin(applications, and(eq(applications.jobId, jobs.id), eq(applications.userId, userId)))
    // The corpus grows by hundreds of jobs a day; the list only shows listings still seen in a feed recently,
    // plus anything this user has already acted on (saved, applied, notes).
    .where(jobId ? eq(jobs.id, jobId) : or(gte(jobs.updatedAt, new Date(Date.now() - LIST_MAX_AGE_DAYS * 86_400_000)), isNotNull(applications.status)))
    .orderBy(desc(userJobScores.score), desc(jobs.discoveredAt));
  if (!rows.length) return [];
  const links = await db.select({ jobId: sourceListings.jobId, source: sourceListings.source, url: sourceListings.url }).from(sourceListings)
    .where(inArray(sourceListings.jobId, rows.map(({ job }) => job.id)))
    .orderBy(asc(sourceListings.source));
  const linksByJob = new Map<string, Array<{ source: string; url: string }>>();
  for (const link of links) {
    const list = linksByJob.get(link.jobId) ?? [];
    list.push({ source: link.source, url: link.url });
    linksByJob.set(link.jobId, list);
  }
  return rows.map(({ job, rawData, application, match, description }) => {
    const sources = linksByJob.get(job.id) ?? [];
    return {
      source: sources[0]?.source ?? "unknown",
      sourceJobId: undefined, url: job.canonicalUrl, title: job.title, company: job.company,
      description, location: job.location, countries: job.countries, hiringRestriction: job.hiringRestriction,
      timezoneRequirements: job.timezoneRequirements, employmentType: job.employmentType,
      contractType: job.contractType, salaryMin: job.salaryMin ?? undefined, salaryMax: job.salaryMax ?? undefined,
      salaryCurrency: job.salaryCurrency ?? undefined, salaryPeriod: job.salaryPeriod ?? undefined,
      technologies: job.technologies, seniority: job.seniority, postedAt: job.postedAt?.toISOString(),
      expiresAt: job.expiresAt?.toISOString(), remoteType: job.remoteType, rawData,
      score: match.score, scoreBreakdown: match.scoreBreakdown, recommendation: match.recommendation,
      id: job.id, discoveredAt: job.discoveredAt.toISOString(), status: application?.status ?? "NEW",
      notes: application?.notes ?? "", sources,
    };
  });
}

// One entry per country (jobs.countries is a jsonb array), so the filter never offers "Germany, France, Spain".
export async function getJobLocations(): Promise<string[]> {
  if (!db) return [];
  const rows = await db.execute<{ country: string }>(sql`select distinct btrim(c) as country from ${jobs}, jsonb_array_elements_text(${jobs.countries}) as c where btrim(c) <> '' order by country`);
  return rows.rows.map(({ country }) => country);
}

async function ensureUserScores(userId: string) {
  if (!db) return;
  // Only load jobs that have no score for this user yet (usually none).
  const missing = await db.select(jobColumnsWithoutRaw).from(jobs).where(notExists(db.select({ one: sql`1` }).from(userJobScores).where(and(eq(userJobScores.jobId, jobs.id), eq(userJobScores.userId, userId)))));
  if (!missing.length) return;
  const profile = await getScoringProfile(userId);
  await upsertScores(missing.map((job) => scoreRow(userId, job.id, normalizedStoredJob(job), profile)), { overwrite: false });
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

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const companyTitleKey = (company: string, title: string) => `${company}\u0000${title}`;
const listingKey = (item: { source: string; sourceJobId: string | null; url: string }) => item.sourceJobId ? `id\u0000${item.source}\u0000${item.sourceJobId}` : `url\u0000${item.source}\u0000${item.url}`;

// Runs twice daily over every feed, where almost every listing is already stored. Dedupe lookups are one
// query per call, existing jobs keep their scores (profile saves, new users and `jobs:rescore` handle those),
// and unchanged listings only get a bulk lastSeenAt bump.
export async function persistJobs(source: string, normalizedJobs: NormalizedJob[], profile = defaultProfile) {
  if (!db) return { discovered: normalizedJobs.length, added: 0, duplicates: normalizedJobs.length };
  const candidates = deduplicateJobs(normalizedJobs).map((group) => ({ group, raw: group.canonical, hash: contentHash(group.canonical), company: normalizeKey(group.canonical.company), title: normalizeKey(group.canonical.title) }));
  if (!candidates.length) return { discovered: normalizedJobs.length, added: 0, duplicates: 0 };

  // Same normalization as normalizeKey, so "CFD Engineer - AI Trainer" matches its own stored row.
  const normalizedCompany = sql<string>`trim(regexp_replace(lower(${jobs.company}), '[^a-z0-9]+', ' ', 'g'))`;
  const normalizedTitle = sql<string>`trim(regexp_replace(lower(${jobs.title}), '[^a-z0-9]+', ' ', 'g'))`;
  const known = await db.select({ id: jobs.id, canonicalUrl: jobs.canonicalUrl, contentHash: jobs.contentHash, company: normalizedCompany, title: normalizedTitle }).from(jobs).where(or(
    inArray(jobs.canonicalUrl, candidates.map((item) => item.raw.url)),
    inArray(jobs.contentHash, candidates.map((item) => item.hash)),
    sql`(${normalizedCompany}, ${normalizedTitle}) in (${sql.join(candidates.map((item) => sql`(${item.company}, ${item.title})`), sql`, `)})`,
  ));
  const byUrl = new Map(known.map((row) => [row.canonicalUrl, row.id]));
  const byHash = new Map(known.map((row) => [row.contentHash, row.id]));
  const byCompanyTitle = new Map(known.map((row) => [companyTitleKey(row.company, row.title), row.id]));

  let added = 0;
  let duplicates = 0;
  const seenJobIds = new Set<string>();
  const newJobs: Array<{ id: string; raw: NormalizedJob }> = [];
  const listings: Array<{ jobId: string; source: string; sourceJobId: string | null; url: string }> = [];
  for (const { group, raw, hash, company, title } of candidates) {
    let jobId = byUrl.get(raw.url) ?? byHash.get(hash) ?? byCompanyTitle.get(companyTitleKey(company, title));
    if (jobId) {
      duplicates++;
      seenJobIds.add(jobId);
    } else {
      const scored = scoreJob(raw, profile);
      const created = await db.insert(jobs).values({
        canonicalUrl: raw.url, title: raw.title, company: raw.company, description: raw.description, location: raw.location,
        countries: raw.countries, hiringRestriction: raw.hiringRestriction ?? [], timezoneRequirements: raw.timezoneRequirements, employmentType: raw.employmentType,
        contractType: raw.contractType, salaryMin: raw.salaryMin, salaryMax: raw.salaryMax, salaryCurrency: raw.salaryCurrency,
        salaryPeriod: raw.salaryPeriod, technologies: raw.technologies, seniority: raw.seniority,
        postedAt: raw.postedAt ? new Date(raw.postedAt) : null, expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : null,
        remoteType: raw.remoteType, rawData: raw.rawData, contentHash: hash, score: scored.score,
        scoreBreakdown: scored.scoreBreakdown, recommendation: scored.recommendation,
      }).returning({ id: jobs.id });
      jobId = created[0].id;
      byUrl.set(raw.url, jobId);
      byHash.set(hash, jobId);
      byCompanyTitle.set(companyTitleKey(company, title), jobId);
      newJobs.push({ id: jobId, raw });
      added++;
    }
    for (const listing of group.listings) listings.push({ jobId, source: listing.source || source, sourceJobId: listing.sourceJobId ?? null, url: listing.url });
  }

  const now = new Date();
  if (seenJobIds.size) await db.update(jobs).set({ updatedAt: now }).where(inArray(jobs.id, [...seenJobIds]));
  if (newJobs.length) {
    const candidateUsers = await scoringUsers();
    await upsertScores(candidateUsers.flatMap((user) => newJobs.map(({ id, raw }) => scoreRow(user.id, id, raw, user.profile))), { overwrite: true });
  }

  const existingListings = await db.select({ id: sourceListings.id, jobId: sourceListings.jobId, source: sourceListings.source, sourceJobId: sourceListings.sourceJobId, url: sourceListings.url }).from(sourceListings)
    .where(inArray(sourceListings.source, [...new Set(listings.map((listing) => listing.source))]));
  const existingByKey = new Map(existingListings.map((row) => [listingKey(row), row]));
  const unchanged: string[] = [];
  for (const listing of listings) {
    const existing = existingByKey.get(listingKey(listing));
    if (existing && existing.jobId === listing.jobId && existing.url === listing.url) { unchanged.push(existing.id); continue; }
    const conflictTarget = listing.sourceJobId ? [sourceListings.source, sourceListings.sourceJobId] : [sourceListings.source, sourceListings.url];
    await db.insert(sourceListings).values({ ...listing, lastSeenAt: now })
      .onConflictDoUpdate({ target: conflictTarget, set: { jobId: listing.jobId, url: listing.url, lastSeenAt: now } });
  }
  if (unchanged.length) await db.update(sourceListings).set({ lastSeenAt: now }).where(inArray(sourceListings.id, unchanged));
  return { discovered: normalizedJobs.length, added, duplicates };
}

export function demoJob(id: string) { return sampleJobs.find((item) => item.id === id); }
