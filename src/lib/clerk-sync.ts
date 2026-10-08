import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateProfiles, notificationSettings, users } from "@/db/schema";
import { defaultProfile } from "@/lib/profile";

type ClerkUserPayload = { id: string; first_name?: string | null; last_name?: string | null; image_url?: string | null; primary_email_address_id?: string | null; email_addresses?: Array<{ id: string; email_address: string; verification?: { status?: string } | null }> };

export async function syncClerkUser(payload: ClerkUserPayload) {
  if (!db) throw new Error("DATABASE_URL is required");
  const emailEntry = payload.email_addresses?.find((item) => item.id === payload.primary_email_address_id);
  const email = emailEntry?.email_address.trim().toLowerCase();
  if (!email || emailEntry?.verification?.status !== "verified") return;
  const admins = new Set((process.env.APP_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  const isAdmin = admins.has(email);
  const isOwner = email === process.env.APP_OWNER_EMAIL?.trim().toLowerCase();
  let row = (await db.select().from(users).where(eq(users.clerkUserId, payload.id)).limit(1))[0];
  if (!row) row = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ") || null;
  if (row) {
    await db.update(users).set({ clerkUserId: payload.id, email, name, image: payload.image_url ?? null, emailVerified: new Date(), role: isAdmin ? "admin" : "member", ownerPro: isOwner }).where(eq(users.id, row.id));
  } else {
    const created = await db.insert(users).values({ id: randomUUID(), clerkUserId: payload.id, email, name, image: payload.image_url ?? null, emailVerified: new Date(), role: isAdmin ? "admin" : "member", ownerPro: isOwner }).returning({ id: users.id });
    row = { id: created[0].id } as typeof users.$inferSelect;
  }
  await db.insert(candidateProfiles).values({ userId: row.id, ...defaultProfile, scoreWeights: defaultProfile.scoreWeights }).onConflictDoNothing();
  await db.insert(notificationSettings).values({ userId: row.id }).onConflictDoNothing();
}
