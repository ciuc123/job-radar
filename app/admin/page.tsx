import Link from "next/link";
import { redirect } from "next/navigation";
import { count, desc, gte, sql } from "drizzle-orm";
import { getCurrentAppUser } from "@/lib/app-user";
import SiteHeader from "@/components/site-header";
import { db } from "@/db";
import { aiAnalyses, users } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const current = await getCurrentAppUser();
  if (current?.role !== "admin") redirect("/");
  const accounts = db ? await db.select({ email: users.email, role: users.role, plan: users.subscriptionPlan, status: users.subscriptionStatus, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(100) : [];
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [aiUsage] = db ? await db.select({ analyses: count(), costMicros: sql<number>`coalesce(sum(${aiAnalyses.costUsdMicros}), 0)::int`, cacheReads: sql<number>`coalesce(sum(${aiAnalyses.cacheReadTokens}), 0)::int` }).from(aiAnalyses).where(gte(aiAnalyses.analyzedAt, monthStart)) : [];
  return <main className="app-shell settings-shell"><SiteHeader userName={current?.name ?? "Admin"} isAdmin={true} isLoggedIn={true} backHref="/" backLabel={<>{""} Dashboard</>} /><section className="settings-content"><p className="eyebrow">OWNER ADMIN</p><h1>Account overview</h1><p className="muted">Use the support link on the dashboard for user requests. Your owner account has Pro entitlements without a paid subscription.</p><div className="card network-card"><strong>AI usage this month</strong><p>{aiUsage ? `${aiUsage.analyses} analyses · ≈ $${(aiUsage.costMicros / 1_000_000).toFixed(2)} · ${aiUsage.cacheReads.toLocaleString("en-GB")} cache-read tokens` : "No database configured"}</p><p>Estimated from logged token usage; the Claude Console usage page is the billing source of truth.</p></div><div className="card network-card"><strong>{accounts.length} accounts</strong>{accounts.map((account) => <p key={account.email}>{account.email} · {account.role} · {account.plan} ({account.status})</p>)}</div></section></main>;
}
