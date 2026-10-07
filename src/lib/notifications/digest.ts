import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { jobs, notificationSettings, users } from "@/db/schema";

export async function sendDailyDigests() {
  if (!db || process.env.EMAIL_NOTIFICATIONS_ENABLED !== "true" || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return 0;
  const recipients = await db.select({ userId: users.id, email: users.email, settings: notificationSettings }).from(users).innerJoin(notificationSettings, eq(notificationSettings.userId, users.id)).where(or(eq(notificationSettings.dailyDigestEnabled, true), eq(notificationSettings.immediateEnabled, true)));
  let sent = 0;
  for (const recipient of recipients) {
    if (recipient.settings.dailyDigestEnabled && (!recipient.settings.lastDigestAt || Date.now() - recipient.settings.lastDigestAt.getTime() >= 20 * 60 * 60 * 1000)) {
      const recent = await db.select().from(jobs).where(and(gte(jobs.discoveredAt, new Date(Date.now() - 24 * 60 * 60 * 1000)), gte(jobs.score, recipient.settings.immediateThreshold))).orderBy(desc(jobs.score)).limit(20);
      if (recent.length) {
        const content = recent.map((job, index) => `${index + 1}. ${job.score} — ${job.title}\n${job.company} · ${job.location || "Remote location unspecified"}\n${job.canonicalUrl}`).join("\n\n");
        const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [recipient.email], subject: `Your Job Radar — ${recent.length} strong matches`, text: `Jobs discovered in the last 24 hours:\n\n${content}\n\nReview each listing and apply manually.` }) });
        if (response.ok) { await db.update(notificationSettings).set({ lastDigestAt: new Date() }).where(eq(notificationSettings.userId, recipient.userId)); sent++; }
        else console.error(JSON.stringify({ event: "email.digest_failed", userId: recipient.userId, status: response.status }));
      }
    }
    if (recipient.settings.immediateEnabled) {
      const urgent = await db.select().from(jobs).where(and(gte(jobs.discoveredAt, new Date(Date.now() - 60 * 60 * 1000)), gte(jobs.score, recipient.settings.immediateThreshold), isNull(jobs.immediateSentAt))).orderBy(desc(jobs.score)).limit(10);
      if (urgent.length) {
        const content = urgent.map((job) => `${job.score} — ${job.title}\n${job.company} · ${job.location || "Remote location unspecified"}\n${job.canonicalUrl}`).join("\n\n");
        const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [recipient.email], subject: `Job Radar alert — ${urgent.length} high match${urgent.length === 1 ? "" : "es"}`, text: `New high scoring jobs:\n\n${content}\n\nReview and apply manually.` }) });
        if (response.ok) { await db.update(jobs).set({ immediateSentAt: new Date() }).where(inArray(jobs.id, urgent.map((job) => job.id))); sent++; }
        else console.error(JSON.stringify({ event: "email.immediate_failed", userId: recipient.userId, status: response.status }));
      }
    }
  }
  return sent;
}
