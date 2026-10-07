import { contentHash, descriptionHash, normalizeUrl } from "@/lib/jobs/normalize";
import type { NormalizedJob } from "@/lib/types";

export type DuplicateGroup<T extends NormalizedJob> = { canonical: T; listings: T[] };

function identityKeys(job: NormalizedJob) {
  const companyTitle = `${job.company.toLowerCase().replace(/[^a-z0-9]/g, "")}::${job.title.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const description = job.description.replace(/\s+/g, " ").trim();
  return [
    job.sourceJobId ? `id:${job.source}:${job.sourceJobId}` : "",
    `url:${normalizeUrl(job.url)}`,
    `ct:${companyTitle}`,
    `hash:${contentHash(job)}`,
    description.length >= 120 ? `body:${descriptionHash(description)}` : "",
  ].filter(Boolean);
}

export function deduplicateJobs<T extends NormalizedJob>(items: T[]): DuplicateGroup<T>[] {
  const groups: DuplicateGroup<T>[] = [];
  const byIdentity = new Map<string, DuplicateGroup<T>>();
  const findGroup = (job: T) => {
    return identityKeys(job).map((key) => byIdentity.get(key)).find(Boolean);
  };
  for (const job of items) {
    const existing = findGroup(job);
    if (existing) {
      existing.listings.push(job);
      for (const key of identityKeys(job)) byIdentity.set(key, existing);
    }
    else {
      const group = { canonical: job, listings: [job] };
      groups.push(group);
      for (const key of identityKeys(job)) byIdentity.set(key, group);
    }
  }
  return groups;
}
