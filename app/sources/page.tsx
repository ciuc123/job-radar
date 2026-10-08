import { getCurrentAppUser } from "@/lib/app-user";
import { db } from "@/db";
import { sourceHealth } from "@/db/schema";
import { sourceRegistry } from "@/lib/sources/registry";
import Link from "next/link";

export const dynamic = "force-dynamic";

function SourceCard({ source, health }: {
  source: (typeof sourceRegistry)[number];
  health?: typeof sourceHealth.$inferSelect;
}) {
  return (
    <article className="network-card card">
      <div>
        <h2>{source.name}</h2>
        <span className="pill">{health?.status ?? (source.available ? "not fetched" : "unavailable")}</span>
      </div>
      <p>{health?.lastError ?? source.unavailableReason ?? `${health?.discovered ?? 0} discovered · ${health?.added ?? 0} added · ${health?.duplicates ?? 0} duplicates`}</p>
      <small>{health?.lastCompletedAt ? `Last completed ${health.lastCompletedAt.toLocaleString()}` : source.available ? "No completed fetch recorded" : "Not fetched because no permitted feed is configured"}</small>
    </article>
  );
}

export default async function SourcesPage() {
  const user = await getCurrentAppUser();
  if (!user?.id) return <main className="page-shell"><Link className="button button-primary" href="/signin">Sign in</Link></main>;

  const rows = db ? await db.select().from(sourceHealth) : [];
  const health = new Map(rows.map((row) => [row.source, row]));
  const availableSources = sourceRegistry.filter((source) => source.available);
  const unavailableSources = sourceRegistry.filter((source) => !source.available);

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="brand" href="/">JOB RADAR</Link>
        <nav><Link href="/">Jobs</Link><Link href="/network">My network</Link><Link href="/sources">Source health</Link></nav>
      </header>
      <section className="page-heading">
        <p className="eyebrow">OPERATIONS</p>
        <h1>Source health</h1>
        <p>Each active source is fetched independently. A source failure does not stop the others.</p>
      </section>

      <section className="network-list" aria-label="Available job sources">
        {availableSources.map((source) => <SourceCard key={source.id} source={source} health={health.get(source.id)} />)}
      </section>

      {unavailableSources.length > 0 && (
        <details style={{ marginTop: 22, border: "1px solid var(--line)", borderRadius: 12, background: "white", boxShadow: "var(--shadow)" }}>
          <summary style={{ cursor: "pointer", padding: "15px 18px", fontSize: 12, fontWeight: 700, color: "#4c5a51" }}>
            <span>Unavailable sources</span>
            <span className="pill">{unavailableSources.length}</span>
            <small>Show sources without a verified public feed</small>
          </summary>
          <section className="network-list" aria-label="Unavailable job sources" style={{ padding: "3px 14px 10px" }}>
            {unavailableSources.map((source) => <SourceCard key={source.id} source={source} health={health.get(source.id)} />)}
          </section>
        </details>
      )}
    </main>
  );
}
