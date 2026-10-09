import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Bookmark, CalendarDays, CircleDollarSign, MapPin, Sparkles } from "lucide-react";
import SiteHeader from "@/components/site-header";
import { getCurrentAppUser, hasPaidFeature } from "@/lib/app-user";
import { updateJobAction } from "@/app/actions";
import { getDashboardJobs, hasDatabase } from "@/lib/repository/jobs";
import { db } from "@/db";
import { aiAnalyses } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentAppUser();
  const jobs = await getDashboardJobs(user?.id);
  const job = jobs.find((item) => item.id === id);
  if (!job) notFound();
  const editable = hasDatabase();
  const applyUrl = job.sources[0]?.url ?? job.url;
  const canUseAi = await hasPaidFeature("ai_analysis");
  const aiAnalysis = db && canUseAi && user && !id.startsWith("demo-") ? (await db.select().from(aiAnalyses).where(and(eq(aiAnalyses.jobId, id), eq(aiAnalyses.userId, user.id))).limit(1))[0] : undefined;

  return <main className="app-shell detail-shell">
    <SiteHeader userName={user?.name ?? "Developer"} isAdmin={user?.role === "admin"} backHref="/" backLabel={<><ArrowLeft size={16}/> Back to shortlist</>} />
    <div className="detail-layout">
      <section className="detail-main">
        <div className="detail-heading"><div className={`score-badge score-large ${job.score >= 85 ? "score-hot" : job.score >= 70 ? "score-good" : job.score >= 50 ? "score-mid" : "score-low"}`}><strong>{job.score}</strong><small>FIT SCORE</small></div><div><p className="eyebrow">{job.sources.map((item) => item.source).join(" · ")}</p><h1>{job.title}</h1><p className="detail-company">{job.company}</p></div></div>
        <div className="detail-actions">
          <a className="button button-primary" href={applyUrl} target="_blank" rel="noreferrer">Open original listing <ArrowUpRight size={16}/></a>
          {editable ? <form action={updateJobAction} className="inline-action"><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="status" value="SAVED"/><button className="button button-secondary" type="submit"><Bookmark size={15}/> Save</button></form> : <button className="button button-secondary" disabled title="Connect Neon and sign in to save jobs"><Bookmark size={15}/> Save</button>}
          {editable && <form action={updateJobAction} className="inline-action"><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="status" value="REJECTED"/><button className="button button-quiet" type="submit">Reject</button></form>}
        </div>
        {!editable && <p className="demo-notice">Demo mode is read-only. Add a Neon database to save, reject, or track applications.</p>}
        <div className="detail-facts">
          <div><MapPin/><span>LOCATION</span><strong>{job.location || job.remoteType}</strong></div>
          <div><CircleDollarSign/><span>COMPENSATION</span><strong>{job.salaryMin != null || job.salaryMax != null ? `${job.salaryCurrency ?? ""} ${job.salaryMin ?? ""}${job.salaryMax != null ? `–${job.salaryMax}` : ""} ${job.salaryPeriod ?? ""}` : "Not listed"}</strong></div>
          <div><CalendarDays/><span>POSTED</span><strong>{job.postedAt ? new Date(job.postedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable"}</strong></div>
          <div><span className="fact-icon">↗</span><span>EMPLOYMENT</span><strong>{[...job.employmentType, ...job.contractType].join(" · ") || "Not specified"}</strong></div>
        </div>
        <div className="detail-section"><div className="section-title"><h2>Why it matches</h2><span className={`recommendation recommendation-${job.recommendation.toLowerCase()}`}>{job.recommendation === "MAYBE" ? "PIPELINE" : job.recommendation}</span></div><p className="muted">Pipeline roles are backend jobs. Review roles also use PHP and Laravel. Strong matches additionally meet your salary floor and are fully remote.</p><div className="match-list">{Object.entries(job.scoreBreakdown).filter(([, points]) => points > 0).slice(0, 10).map(([reason, points]) => <span key={reason} className="match-chip">{reason.replace(/^(skill\.|location\.|employment\.|seniority\.|tier\.)/, "").replaceAll(".", " ")} <b>+{points}</b></span>)}</div>{Object.entries(job.scoreBreakdown).some(([, points]) => points < 0) && <p className="concern-line">Concerns: {Object.entries(job.scoreBreakdown).filter(([, points]) => points < 0).map(([reason]) => reason.replace("negative.", "").replaceAll("_", " ")).join(", ")}</p>}</div>
        <div className="detail-section"><h2>Technologies</h2><div className="tech-tags tech-tags-large">{job.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div></div>
        <div className="detail-section description-section"><h2>Job description</h2><p>{job.description || "The source did not include a full description."}</p></div>
        <div className="detail-section"><h2>Found on</h2><div className="source-links">{job.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={`${source.source}-${source.url}`}>{source.source} <ArrowUpRight size={14}/></a>)}</div></div>
        <div className="detail-section notes-section"><div className="section-title"><h2>Application notes</h2><span className="status-pill">{job.status}</span></div>{editable ? <form action={updateJobAction}><input type="hidden" name="jobId" value={job.id}/><label htmlFor="notes">Private notes</label><textarea id="notes" name="notes" defaultValue={job.notes} placeholder="What stood out? Follow-up details…"/><div className="tracker-controls"><select name="status" defaultValue={job.status}><option>NEW</option><option>SAVED</option><option>REVIEW</option><option>APPLIED</option><option>INTERVIEW</option><option>OFFER</option><option>REJECTED</option><option>WITHDRAWN</option></select><button className="button button-secondary" type="submit">Save update</button></div></form> : <p className="muted">Connect Neon to keep private notes and track this opportunity.</p>}</div>
      </section>
      <aside className="detail-aside"><div className="aside-card"><div className="ai-icon"><Sparkles size={18}/></div><h3>AI analysis</h3><span className="status-pill">{aiAnalysis ? `${aiAnalysis.score} · ${aiAnalysis.recommendation}` : canUseAi ? "READY WHEN CONFIGURED" : "PRO FEATURE"}</span>{aiAnalysis ? <><p>{aiAnalysis.summary}</p><p><strong>Matches:</strong> {aiAnalysis.matches.join(", ") || "None listed"}</p><p><strong>Gaps:</strong> {aiAnalysis.gaps.join(", ") || "None listed"}</p><p><strong>Concerns:</strong> {aiAnalysis.concerns.join(", ") || "None found"}</p></> : <p>{canUseAi ? "Analysis is generated for strong matches when an AI-compatible endpoint is configured. Deterministic rules remain the source of the main score." : "Upgrade to Pro to unlock cached AI analysis for relevant roles."}</p>}</div><div className="aside-card"><p className="eyebrow">APPLICATION SAFETY</p><p>Job Radar never submits an application. Use the original listing to review requirements and apply yourself.</p></div></aside>
    </div>
  </main>;
}
