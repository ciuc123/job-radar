import { loadEnvConfig } from "@next/env";

// One-off: re-derives `countries` (one entry per country) and `hiring_restriction` for jobs stored before those
// were parsed. persistJobs never rewrites existing rows, so run this once after deploying the migration.
async function main() {
  loadEnvConfig(process.cwd());
  const [{ db }, { jobs }, { eq }, { normalizeCountries }, { detectHiringRestriction }] = await Promise.all([
    import("@/db"), import("@/db/schema"), import("drizzle-orm"), import("@/lib/jobs/countries"), import("@/lib/jobs/restrictions"),
  ]);
  if (!db) throw new Error("DATABASE_URL is required to backfill jobs");
  const rows = await db.select({ id: jobs.id, title: jobs.title, description: jobs.description, location: jobs.location, countries: jobs.countries, hiringRestriction: jobs.hiringRestriction }).from(jobs);
  let updated = 0;
  for (const row of rows) {
    const countries = normalizeCountries(row.countries, row.location);
    const hiringRestriction = detectHiringRestriction(`${row.title}. ${row.description}`);
    if (JSON.stringify(countries) === JSON.stringify(row.countries) && JSON.stringify(hiringRestriction) === JSON.stringify(row.hiringRestriction)) continue;
    await db.update(jobs).set({ countries, hiringRestriction }).where(eq(jobs.id, row.id));
    updated++;
  }
  console.info(JSON.stringify({ event: "jobs.backfill_completed", scanned: rows.length, updated }));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
