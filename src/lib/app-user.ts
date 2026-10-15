import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { accessForEmail, syncClerkUser } from "@/lib/clerk-sync";

// Memoized per request. The Clerk API call and account sync only run when no local user row exists yet
// (first sign-in); afterwards the Clerk webhook keeps the row current.
export const getCurrentAppUser = cache(async () => {
  const { userId } = await auth();
  if (!userId || !db) return null;
  const existing = (await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1))[0];
  if (existing) {
    // Env-driven access is re-evaluated on every request, so changing APP_ADMIN_EMAILS / APP_OWNER_EMAIL applies
    // without waiting for a Clerk webhook. Persisted when it changes so scheduled workers see it too.
    const access = accessForEmail(existing.email);
    if (access.role === existing.role && access.ownerPro === existing.ownerPro) return existing;
    await db.update(users).set(access).where(eq(users.id, existing.id));
    return { ...existing, ...access };
  }
  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  await syncClerkUser({ id: clerkUser.id, first_name: clerkUser.firstName, last_name: clerkUser.lastName, image_url: clerkUser.imageUrl, primary_email_address_id: clerkUser.primaryEmailAddressId, email_addresses: clerkUser.emailAddresses.map((item) => ({ id: item.id, email_address: item.emailAddress, verification: item.verification })) });
  return (await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1))[0] ?? null;
});

export async function requireAppUser() {
  const user = await getCurrentAppUser();
  if (!user) throw new Error("Sign in required");
  return user;
}

export async function hasPaidFeature(feature: "ai_analysis" | "email_alerts" | "source_refresh") {
  const user = await getCurrentAppUser();
  if (!user) return false;
  if (user.ownerPro) return true;
  if (feature === "ai_analysis" && user.aiBeta) return true;
  const { has } = await auth();
  return has({ feature });
}
