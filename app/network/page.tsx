import { getCurrentAppUser } from "@/lib/app-user";
import { db } from "@/db";
import { networkPipelines } from "@/db/schema";
import { eq } from "drizzle-orm";
import { saveNetworkPipelineAction } from "@/app/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const user = await getCurrentAppUser();
  if (!user?.id) return <main className="auth-shell"><Link className="button button-primary" href="/signin">Sign in to view your private pipeline</Link></main>;
  const entries = db ? await db.select().from(networkPipelines).where(eq(networkPipelines.userId, user.id)).orderBy(networkPipelines.updatedAt) : [];
  return <main className="page-shell"><header className="topbar"><Link className="brand" href="/">JOB RADAR</Link><nav><Link href="/">Jobs</Link><Link href="/network">My network</Link><Link href="/settings">Profile</Link></nav></header>
    <section className="page-heading"><div><p className="eyebrow">PRIVATE TRACKER</p><h1>Platforms & follow-ups</h1><p>Track profile reviews, waitlists, applications, and weekly check-ins separately from job discovery.</p></div></section>
    {!db && <p className="notice">Configure Neon to save private tracker entries.</p>}
    <form action={saveNetworkPipelineAction} className="network-form card"><h2>Add platform or follow-up</h2><div className="form-grid"><label>Platform / company<input name="name" required maxLength={120} /></label><label>Status<select name="status"><option>FOLLOW_UP</option><option>IN_PROGRESS</option><option>WAITING</option><option>READY</option><option>PAUSED</option><option>CLOSED</option></select></label><label>Cadence<input name="cadence" placeholder="Weekly" /></label><label>Next action<input name="nextAction" placeholder="Complete profile review" /></label></div><label>Notes and history<textarea name="notes" rows={3} placeholder="Add dated updates, one per line" /></label><button className="button button-primary" disabled={!db}>Save entry</button></form>
    <section className="network-list">{entries.length ? entries.map((entry) => <article className="card network-card" key={entry.id}><div><h2>{entry.name}</h2><span className="pill">{entry.status.replaceAll("_", " ")}</span>{entry.cadence && <span className="muted"> · {entry.cadence}</span>}</div>{entry.nextAction && <p><strong>Next:</strong> {entry.nextAction}</p>}{entry.notes && <pre>{entry.notes}</pre>}<small>Updated {entry.updatedAt.toLocaleDateString()}</small></article>) : <div className="empty-state card">No platforms tracked yet. Add your current opportunities and follow-ups above.</div>}</section>
  </main>;
}
