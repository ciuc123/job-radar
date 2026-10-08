import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { clerkWebhookEvents, users } from "@/db/schema";
import { syncClerkUser } from "@/lib/clerk-sync";

type BillingData = { payer?: { user_id?: string; id?: string }; user_id?: string; user?: { id?: string }; plan?: { slug?: string }; plan_slug?: string; status?: string };

export async function POST(request: NextRequest) {
  if (!db) return new Response("Database unavailable", { status: 503 });
  try {
    const event = await verifyWebhook(request);
    const eventId = (event as typeof event & { id?: string }).id;
    if (!eventId) return new Response("Missing webhook event ID", { status: 400 });
    const seen = await db.select({ id: clerkWebhookEvents.id }).from(clerkWebhookEvents).where(eq(clerkWebhookEvents.id, eventId)).limit(1);
    if (seen.length) return new Response("Already processed", { status: 200 });

    if (event.type === "user.created" || event.type === "user.updated") {
      await syncClerkUser(event.data as Parameters<typeof syncClerkUser>[0]);
    } else if (event.type === "user.deleted") {
      const deletedId = event.data.id;
      if (deletedId) await db.update(users).set({ clerkUserId: null, role: "member", ownerPro: false }).where(eq(users.clerkUserId, deletedId));
    } else if (event.type.startsWith("subscriptionItem.") && event.type !== "subscriptionItem.upcoming") {
      const data = event.data as BillingData;
      const clerkUserId = data.payer?.user_id ?? data.user_id ?? data.user?.id;
      if (clerkUserId) {
        const plan = data.plan?.slug ?? data.plan_slug ?? "free";
        const itemState = data.status ?? event.type.split(".")[1];
        const active = ["active", "canceled", "updated"].includes(itemState) && plan === "pro";
        const eventTime = new Date(event.timestamp);
        const current = await db.select({ id: users.id, syncedAt: users.subscriptionSyncedAt }).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
        if (current[0] && (!current[0].syncedAt || eventTime >= current[0].syncedAt)) await db.update(users).set({ subscriptionPlan: active ? "pro" : "free", subscriptionStatus: active ? "active" : itemState, subscriptionSyncedAt: eventTime }).where(eq(users.id, current[0].id));
      }
    }
    await db.insert(clerkWebhookEvents).values({ id: eventId, eventType: event.type }).onConflictDoNothing();
    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    console.error("Clerk webhook verification or processing failed", error);
    return new Response("Webhook failed", { status: 400 });
  }
}
