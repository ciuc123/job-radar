import type { NormalizedJob } from "@/lib/types";
import { normalizeJob } from "@/lib/jobs/normalize";
import type { JobSource } from "@/lib/sources/job-source";

type HimalayasJob = {
  title?: string; companyName?: string; employmentType?: string; minSalary?: number | null; maxSalary?: number | null;
  salaryPeriod?: string; currency?: string; seniority?: string[] | string; locationRestrictions?: Array<string | { name?: string }>;
  timezoneRestrictions?: string[]; categories?: string[]; description?: string; excerpt?: string; pubDate?: number | string;
  expiryDate?: number | string; applicationLink?: string; guid?: string;
};
type HimalayasPage = { jobs?: HimalayasJob[]; nextCursor?: string };

const toIso = (value?: number | string) => value ? new Date(typeof value === "number" ? value : value).toISOString() : undefined;

export function mapHimalayasJob(item: HimalayasJob): NormalizedJob | null {
  if (!item.title || !item.applicationLink) return null;
  const countries = (item.locationRestrictions ?? []).map((country) => typeof country === "string" ? country : country.name ?? "").filter(Boolean);
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
  async fetch() {
    const jobs: NormalizedJob[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const url = new URL("https://himalayas.app/jobs/api");
      url.searchParams.set("limit", "20");
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "JobRadar/1.0 (personal job discovery)" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
      if (!response.ok) throw new Error(`Himalayas returned HTTP ${response.status}`);
      const body = await response.json() as HimalayasPage;
      jobs.push(...(body.jobs ?? []).map(mapHimalayasJob).filter((job): job is NormalizedJob => Boolean(job)));
      cursor = body.nextCursor;
      if (!cursor) break;
    }
    return { source: this.id, jobs };
  },
};
