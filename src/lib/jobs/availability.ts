import { isRegion } from "@/lib/jobs/countries";

/** Where a role can be worked from, as far as the feed and the listing text tell us. */
export type Availability =
  | { kind: "open" }
  | { kind: "regional"; regions: string[] }
  | { kind: "locked"; countries: string[]; source: "listing" | "feed" };

const WORLDWIDE = new Set(["worldwide", "global", "anywhere"]);

/**
 * "listing": the description says it only hires from these countries (hiringRestriction).
 * "feed": the source lists specific countries it accepts (Himalayas location restrictions).
 * A region such as Europe can't confirm a single country, so it is reported as regional rather than locked.
 */
export function jobAvailability(job: { countries: string[]; hiringRestriction?: string[] }): Availability {
  if (job.hiringRestriction?.length) return { kind: "locked", countries: job.hiringRestriction, source: "listing" };
  const regions = job.countries.filter(isRegion);
  if (regions.some((region) => WORLDWIDE.has(region.toLowerCase()))) return { kind: "open" };
  if (regions.length) return { kind: "regional", regions };
  if (job.countries.length) return { kind: "locked", countries: job.countries, source: "feed" };
  return { kind: "open" };
}

/** True when a person living in `country` can take the role: no country lock, a regional role, or the country is accepted. */
export function acceptsCountry(availability: Availability, country: string): boolean {
  if (availability.kind !== "locked") return true;
  return availability.countries.some((item) => item.toLowerCase() === country.toLowerCase());
}
