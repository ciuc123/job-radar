import { jobAvailability, acceptsCountry } from "@/lib/jobs/availability";

// Tells the reader at a glance whether a role is tied to specific countries, so the description needn't be read.
export default function AvailabilityBadge({ job, residenceCountry }: { job: { countries: string[]; hiringRestriction?: string[] }; residenceCountry?: string }) {
  const availability = jobAvailability(job);
  if (availability.kind === "open") return <span className="availability availability-open" title="No country restriction found">🌍 No country lock</span>;
  if (availability.kind === "regional") return <span className="availability availability-regional" title="Limited to a region; check the listing for your country">📍 {availability.regions.join(", ")} only</span>;
  const where = availability.countries.join(", ");
  const title = availability.source === "listing" ? "The listing says it only hires from these countries" : "The source lists these countries as eligible";
  if (!residenceCountry) return <span className="availability availability-locked" title={title}>🔒 Only {where}</span>;
  return acceptsCountry(availability, residenceCountry)
    ? <span className="availability availability-ok" title={title}>🔒 Only {where} · ✓ includes {residenceCountry}</span>
    : <span className="availability availability-locked" title={title}>🔒 Only {where} · ✗ not {residenceCountry}</span>;
}
