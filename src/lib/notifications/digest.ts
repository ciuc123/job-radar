import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { jobs, notificationSettings, users } from "@/db/schema";

export async function sendDailyDigests() {
  if (!db || process.env.EMAIL_NOTIFICATIONS_ENABLED !== "true" || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return 0;
  const recipients = await db.select({ userId: users.id, email: users.email, settings: notificationSettings }).from(users).innerJoin(notificationSettings, eq(notificationSettings.userId, users.id)).where(eq(notificationSettings.dailyDigestEnabled, true));
  let sent = 0;
  for (const recipient of recipients) {
    if (recipient.settings.lastDigestAt && Date.now() - recipient.settings.lastDigestAt.getTime() < 20 * 60 * 60 * 1000) continue;
    const recent = await db.select().from(jobs).where(and(gte(jobs.discoveredAt, new Date(Date.now() - 24 * 60 * 60 * 1000)), gte(jobs.score, recipient.settings.immediateThreshold))).orderBy(desc(jobs.score)).limit(20);
    if (!recent.length) continue;
    const content = recent.map((job, index) => `${index + 1}. ${job.score} — ${job.title}\n${job.company} · ${job.location || "Remote location unspecified"}\n${job.canonicalUrl}`).join("\n\n");
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [recipient.email], subject: `Your Job Radar — ${recent.length} strong matches`, text: `Jobs discovered in the last 24 hours:\n\n${content}\n\nReview each listing and apply manually.` }) });
    if (!response.ok) { console.error(JSON.stringify({ event: "email.digest_failed", userId: recipient.userId, status: response.status })); continue; }
    await db.update(notificationSettings).set({ lastDigestAt: new Date() }).where(eq(notificationSettings.userId, recipient.userId));
    sent++;
  }
  return sent;
}
