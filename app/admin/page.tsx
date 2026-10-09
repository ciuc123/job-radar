import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { getCurrentAppUser } from "@/lib/app-user";
import SiteHeader from "@/components/site-header";
import { db } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const current = await getCurrentAppUser();
  if (current?.role !== "admin") redirect("/");
  const accounts = db ? await db.select({ email: users.email, role: users.role, plan: users.subscriptionPlan, status: users.subscriptionStatus, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(100) : [];
  return <main className="app-shell settings-shell"><SiteHeader userName={current?.name ?? "Admin"} isAdmin={true} backHref="/" backLabel={<>{""} Dashboard</>} /><section className="settings-content"><p className="eyebrow">OWNER ADMIN</p><h1>Account overview</h1><p className="muted">Use the support link on the dashboard for user requests. Your owner account has Pro entitlements without a paid subscription.</p><div className="card network-card"><strong>{accounts.length} accounts</strong>{accounts.map((account) => <p key={account.email}>{account.email} · {account.role} · {account.plan} ({account.status})</p>)}</div></section></main>;
}
