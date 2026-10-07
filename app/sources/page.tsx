import { auth } from "@/auth";
import { db } from "@/db";
import { sourceHealth } from "@/db/schema";
import { sourceRegistry } from "@/lib/sources/registry";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const session = await auth();
  if (!session?.user?.id) return <main className="page-shell"><Link className="button button-primary" href="/signin">Sign in</Link></main>;
  const rows = db ? await db.select().from(sourceHealth) : [];
  const health = new Map(rows.map((row) => [row.source, row]));
  return <main className="page-shell"><header className="topbar"><Link className="brand" href="/">JOB RADAR</Link><nav><Link href="/">Jobs</Link><Link href="/network">My network</Link><Link href="/sources">Source health</Link></nav></header><section className="page-heading"><p className="eyebrow">OPERATIONS</p><h1>Source health</h1><p>Each source is fetched independently. A source failure does not stop the others.</p></section><section className="network-list">{sourceRegistry.map((source) => { const state = health.get(source.id); return <article key={source.id} className="network-card card"><div><h2>{source.name}</h2><span className="pill">{state?.status ?? (source.available ? "not fetched" : "unavailable")}</span></div><p>{state?.lastError ?? source.unavailableReason ?? `${state?.discovered ?? 0} discovered · ${state?.added ?? 0} added · ${state?.duplicates ?? 0} duplicates`}</p><small>{state?.lastCompletedAt ? `Last completed ${state.lastCompletedAt.toLocaleString()}` : source.available ? "No completed fetch recorded" : "Not fetched because no permitted feed is configured"}</small></article>; })}</section></main>;
}
