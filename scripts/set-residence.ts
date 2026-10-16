import { loadEnvConfig } from "@next/env";

// Usage: npm run profile:residence -- <email> <country>
// Sets the country of residence on one user's profile (the preferences page does the same for signed-in users).
async function main() {
  loadEnvConfig(process.cwd());
  const [email, ...rest] = process.argv.slice(2);
  const [{ db }, { candidateProfiles, users }, { eq }, { canonicalCountry }] = await Promise.all([
    import("@/db"), import("@/db/schema"), import("drizzle-orm"), import("@/lib/jobs/countries"),
  ]);
  if (!db) throw new Error("DATABASE_URL is required");
  const country = canonicalCountry(rest.join(" "));
  if (!email || !country) throw new Error("Usage: npm run profile:residence -- <email> <country> (a known country name)");
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user) throw new Error(`No user with email ${email}`);
  const updated = await db.update(candidateProfiles).set({ residenceCountry: country }).where(eq(candidateProfiles.userId, user.id)).returning({ userId: candidateProfiles.userId });
  if (!updated.length) throw new Error("That user has no saved profile yet; save preferences once on the settings page, then re-run");
  console.info(JSON.stringify({ event: "profile.residence_set", country }));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
