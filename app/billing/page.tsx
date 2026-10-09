import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";
import SiteHeader from "@/components/site-header";

export default function BillingPage() {
  return <main className="app-shell settings-shell"><SiteHeader backHref="/" backLabel={<><span /> Dashboard</>} /><section className="settings-content"><p className="eyebrow">PLANS</p><h1>Choose your Job Radar plan</h1><p className="muted">Free includes deterministic job matching and application tracking. Pro adds AI job analysis and email alerts.</p><PricingTable /></section></main>;
}
