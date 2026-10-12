import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Users who may spend AI budget: owner, active Pro subscribers, and invited beta testers. */
export async function eligibleAiUserIds(): Promise<string[]> {
  if (!db) return [];
  const rows = await db.select({ id: users.id }).from(users).where(or(
    eq(users.ownerPro, true),
    eq(users.aiBeta, true),
    and(eq(users.subscriptionPlan, "pro"), eq(users.subscriptionStatus, "active")),
  ));
  return rows.map((row) => row.id);
}
