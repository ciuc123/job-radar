import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { syncClerkUser } from "@/lib/clerk-sync";

export async function getCurrentAppUser() {
  const { userId } = await auth();
  if (!userId || !db) return null;
  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  await syncClerkUser({ id: clerkUser.id, first_name: clerkUser.firstName, last_name: clerkUser.lastName, image_url: clerkUser.imageUrl, primary_email_address_id: clerkUser.primaryEmailAddressId, email_addresses: clerkUser.emailAddresses.map((item) => ({ id: item.id, email_address: item.emailAddress, verification: item.verification })) });
  return (await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1))[0] ?? null;
}

export async function requireAppUser() {
  const user = await getCurrentAppUser();
  if (!user) throw new Error("Sign in required");
  return user;
}

export async function hasPaidFeature(feature: "ai_analysis" | "email_alerts") {
  const user = await getCurrentAppUser();
  if (!user) return false;
  if (user.ownerPro) return true;
  const { has } = await auth();
  return has({ feature });
}
