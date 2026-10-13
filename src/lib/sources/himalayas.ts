import type { NormalizedJob } from "@/lib/types";
import { normalizeJob } from "@/lib/jobs/normalize";
import type { JobSource } from "@/lib/sources/job-source";

type HimalayasJob = {
  title?: string; companyName?: string; employmentType?: string; minSalary?: number | null; maxSalary?: number | null;
  salaryPeriod?: string; currency?: string; seniority?: string[] | string; locationRestrictions?: Array<string | { name?: string }>;
  timezoneRestrictions?: string[]; categories?: string[]; description?: string; excerpt?: string; pubDate?: number | string;
  expiryDate?: number | string; applicationLink?: string; guid?: string;
};
type HimalayasSearchPage = { jobs?: HimalayasJob[]; totalCount?: number };
// Newest pubDate (epoch seconds) already fetched, per lowercased search term.
export type HimalayasState = { watermarks: Record<string, number> };

// Himalayas sends epoch seconds; treating them as milliseconds put every posting in January 1970.
const epochMs = (value: number) => value < 1e12 ? value * 1000 : value;
const toIso = (value?: number | string) => value ? new Date(typeof value === "number" ? epochMs(value) : value).toISOString() : undefined;
const pubSeconds = (item: HimalayasJob) => typeof item.pubDate === "number" ? Math.floor(epochMs(item.pubDate) / 1000) : item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) || 0 : 0;

const PAGE_SIZE = 20;
const DEFAULT_TERMS = ["PHP", "Laravel"];
const intEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]?.trim() || fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function mapHimalayasJob(item: HimalayasJob): NormalizedJob | null {
  if (!item.title || !item.applicationLink) return null;
  const countries = (item.locationRestrictions ?? []).flatMap((country) => {
    if (typeof country === "string") return [country];
    return country && typeof country.name === "string" ? [country.name] : [];
  });
  const description = item.description ?? item.excerpt ?? "";
  return normalizeJob({
    source: "himalayas", sourceJobId: item.guid, url: item.applicationLink, title: item.title,
    company: item.companyName ?? "Unknown company", description,
    location: countries.length ? countries.join(", ") : "Worldwide remote",
    countries, timezoneRequirements: item.timezoneRestrictions ?? [],
    employmentType: item.employmentType ? [item.employmentType] : [],
    contractType: /contract/i.test(item.employmentType ?? "") ? ["Contract"] : [],
    salaryMin: item.minSalary ?? undefined, salaryMax: item.maxSalary ?? undefined,
    salaryCurrency: item.currency, salaryPeriod: item.salaryPeriod,
    technologies: item.categories ?? [],
    seniority: Array.isArray(item.seniority) ? item.seniority.join(", ") : item.seniority ?? "Unknown",
    postedAt: toIso(item.pubDate), expiresAt: toIso(item.expiryDate), remoteType: "Remote",
    rawData: item,
  });
}

export const himalayasSource: JobSource = {
  id: "himalayas", name: "Himalayas", enabled: true, available: true,
  // The full feed carries ~1,300 postings per 12 h across every field, so instead of sampling its newest 200 we run
  // a recent-first search per profile keyword and page only until we reach postings a previous run already saw.
  async fetch(context) {
    const previous = (context?.state as HimalayasState | undefined)?.watermarks ?? {};
    const watermarks: Record<string, number> = { ...previous };
    const terms = new Map<string, string>();
    for (const raw of context?.searchTerms.length ? context.searchTerms : DEFAULT_TERMS) {
      const term = raw.trim();
      if (term && !terms.has(term.toLowerCase())) terms.set(term.toLowerCase(), term);
    }
    const maxPages = intEnv("HIMALAYAS_MAX_PAGES_PER_TERM", 5);
    const delayMs = Number(process.env.HIMALAYAS_REQUEST_DELAY_MS ?? 300) || 0;
    const jobs: NormalizedJob[] = [];
    let requests = 0;
    termLoop: for (const [key, term] of terms) {
      const since = previous[key] ?? 0;
      let newest = since;
      for (let page = 1; page <= maxPages; page++) {
        if (requests++ && delayMs) await pause(delayMs);
        const url = new URL("https://himalayas.app/jobs/api/search");
        url.searchParams.set("q", term);
        url.searchParams.set("sort", "recent");
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(PAGE_SIZE));
        const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "JobRadar/1.0 (personal job discovery)" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
        if (response.status === 429 && requests > 1) {
          // Keep what we have; terms not finished keep their old watermark and are retried next run.
          console.warn(JSON.stringify({ event: "source.rate_limited", source: this.id, term, page }));
          break termLoop;
        }
        if (!response.ok) throw new Error(`Himalayas returned HTTP ${response.status}`);
        const body = await response.json() as HimalayasSearchPage;
        const items = body.jobs ?? [];
        if (!items.length) break;
        for (const item of items) {
          const published = pubSeconds(item);
          if (since && published <= since) continue;
          newest = Math.max(newest, published);
          const mapped = mapHimalayasJob(item);
          if (mapped) jobs.push(mapped);
        }
        // Results are newest-first apart from an occasional pinned posting on page 1, so judge by the oldest item.
        if (since && pubSeconds(items[items.length - 1]) <= since) break;
        if (page * PAGE_SIZE >= (body.totalCount ?? 0)) break;
        if (page === maxPages) console.info(JSON.stringify({ event: "source.pagination_cap_reached", source: this.id, term, maxPages, sinceWatermark: since || null }));
      }
      watermarks[key] = newest;
    }
    return { source: this.id, jobs, state: { watermarks } satisfies HimalayasState };
  },
};
