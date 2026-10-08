import type { NormalizedJob } from "@/lib/types";
import { normalizeJob, parseSalary } from "@/lib/jobs/normalize";
import type { JobSource } from "@/lib/sources/job-source";

type JobgetherListing = {
  id?: string;
  title?: string;
  company?: string;
  url?: string;
  location?: string | string[];
  remote?: string;
  contractType?: string;
  experience?: string;
  salaryRange?: string;
  jobFunctions?: string[];
  postedAt?: string;
  description?: string;
};
type JobgetherResponse = { jobs?: JobgetherListing[]; pagination?: { hasMore?: boolean } };

export function mapJobgetherListing(item: JobgetherListing): NormalizedJob | null {
  if (!item.title || !item.url) return null;
  const locationParts = Array.isArray(item.location) ? item.location : item.location ? [item.location] : [];
  const location = locationParts.filter((part): part is string => typeof part === "string").join(", ");
  const salary = parseSalary(item.salaryRange);
  const technologies = Array.isArray(item.jobFunctions) ? item.jobFunctions.filter((value): value is string => typeof value === "string") : [];
  return normalizeJob({
    source: "jobgether", sourceJobId: item.id, url: item.url, title: item.title,
    company: item.company || "Unknown company", description: item.description || [item.title, item.experience, item.jobFunctions?.join(", ")].filter(Boolean).join(" · "),
    location: location || "Remote", countries: locationParts.filter((part): part is string => typeof part === "string"),
    timezoneRequirements: [], employmentType: item.contractType ? [item.contractType] : [],
    contractType: /freelance|contract|fixed-term/i.test(item.contractType || "") ? [item.contractType!] : [],
    salaryMin: salary.min, salaryMax: salary.max, salaryCurrency: salary.currency, salaryPeriod: salary.period,
    technologies, seniority: item.experience || "Unknown", postedAt: item.postedAt,
    remoteType: item.remote || "Remote", rawData: item,
  });
}

export const jobgetherSource: JobSource = {
  id: "jobgether", name: "Jobgether", enabled: true, available: true,
  async fetch() {
    const jobs: NormalizedJob[] = [];
    for (let page = 1; page <= 10; page++) {
      const url = new URL("https://jobgether.com/api/v1/jobs");
      url.searchParams.set("keyword", "PHP Laravel backend developer");
      url.searchParams.set("locations", "europe");
      url.searchParams.set("sort", "date");
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", "25");
      const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "JobRadar/1.0 (personal job discovery)" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
      if (!response.ok) throw new Error(`Jobgether returned HTTP ${response.status}`);
      const body = await response.json() as JobgetherResponse;
      jobs.push(...(body.jobs ?? []).map(mapJobgetherListing).filter((job): job is NormalizedJob => Boolean(job)));
      if (!body.pagination?.hasMore) break;
    }
    return { source: this.id, jobs };
  },
};
