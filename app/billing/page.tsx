import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";
import SiteHeader from "@/components/site-header";
import { getCurrentAppUser } from "@/lib/app-user";

export default async function BillingPage() {
  const user = await getCurrentAppUser();
  return <main className="app-shell settings-shell"><SiteHeader userName={user?.name ?? undefined} isAdmin={user?.role === "admin"} isLoggedIn={!!user?.id} backHref="/" backLabel={<><span /> Dashboard</>} /><section className="settings-content"><p className="eyebrow">PLANS</p><h1>Choose your Job Radar plan</h1><p className="muted">Free includes deterministic job matching and application tracking. Pro adds:</p>
    <ul className="plan-benefits">
      <li><strong>AI fit analysis</strong>: a verdict, matches, gaps, red flags and talking points for any listing, against your profile.</li>
      <li><strong>Fetch all sources on demand</strong>: refresh every job source from the <Link href="/sources">Sources</Link> page instead of waiting for the twice-daily run.</li>
      <li><strong>Email alerts</strong>: a daily digest and instant alerts for high-scoring matches.</li>
    </ul>
    <PricingTable /></section></main>;
}
