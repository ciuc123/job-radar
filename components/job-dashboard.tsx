"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, CircleCheck, Flame, Search } from "lucide-react";
import type { DashboardJob } from "@/lib/repository/jobs";
import { updateJobAction } from "@/app/actions";
import SiteHeader from "./site-header";

const scoreClass = (score: number) => score >= 85 ? "score-hot" : score >= 70 ? "score-good" : score >= 50 ? "score-mid" : "score-low";
const recommendationLabel = (value: string) => value === "MAYBE" ? "PIPELINE" : value;
function locationLabel(value: string) {
  let label = value.trim();
  const opens = (label.match(/\(/g) ?? []).length;
  let closes = (label.match(/\)/g) ?? []).length;
  while (closes > opens && label.endsWith(")")) {
    label = label.slice(0, -1).trimEnd();
    closes--;
  }
  return label;
}
const salaryLabel = (job: DashboardJob) => {
  if (job.salaryMin == null && job.salaryMax == null) return "Salary not listed";
  const currency = job.salaryCurrency === "EUR" ? "€" : job.salaryCurrency ?? "";
  const fmt = (n?: number) => n == null ? "" : new Intl.NumberFormat().format(n);
  const range = job.salaryMin != null && job.salaryMax != null ? `${currency}${fmt(job.salaryMin)}–${currency}${fmt(job.salaryMax)}` : `${currency}${fmt(job.salaryMin ?? job.salaryMax)}`;
  return `${range}${job.salaryPeriod === "hourly" ? "/h" : job.salaryPeriod === "annual" ? "/yr" : job.salaryPeriod === "monthly" ? "/mo" : ""}`;
};

export function JobDashboard({ jobs, locations: databaseLocations, userName, isAdmin, databaseEnabled, now }: { jobs: DashboardJob[]; locations: string[]; userName: string; isAdmin: boolean; databaseEnabled: boolean; now: string }) {
  const [query, setQuery] = useState("");
  const [recommendation, setRecommendation] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [minimumScore, setMinimumScore] = useState(50);
  const [status, setStatus] = useState("OPEN");
  const [company, setCompany] = useState("ALL");
  const [technology, setTechnology] = useState("ALL");
  const [seniority, setSeniority] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [employment, setEmployment] = useState("ALL");
  const [discovered, setDiscovered] = useState("ALL");
  const [salaryFloor, setSalaryFloor] = useState(0);
  const today = new Date(now).toDateString();
  const openStatuses = ["NEW", "SAVED", "REVIEW"];
  const pipeline = jobs.filter((job) => job.scoreBreakdown["role.backend"] > 0 && openStatuses.includes(job.status)).length;
  const strong = jobs.filter((job) => job.recommendation === "APPLY" && openStatuses.includes(job.status)).length;
  const review = jobs.filter((job) => job.recommendation === "REVIEW" && openStatuses.includes(job.status)).length;
  const applied = jobs.filter((job) => ["APPLIED", "INTERVIEW", "OFFER"].includes(job.status)).length;
  const filtered = useMemo(() => jobs.filter((job) => {
    const haystack = `${job.title} ${job.company} ${job.description} ${job.technologies.join(" ")}`.toLowerCase();
    const age = new Date(now).getTime() - new Date(job.discoveredAt).getTime();
    const statusMatches = status === "ALL" || (status === "OPEN" ? ["NEW", "SAVED", "REVIEW"].includes(job.status) : job.status === status);
    return (!query || haystack.includes(query.toLowerCase()))
      && (recommendation === "ALL" || job.recommendation === recommendation)
      && (source === "ALL" || job.sources.some((item) => item.source === source))
      && job.score >= minimumScore && statusMatches
      && (company === "ALL" || job.company === company)
      && (technology === "ALL" || job.technologies.includes(technology))
      && (seniority === "ALL" || job.seniority.toLowerCase().includes(seniority.toLowerCase()))
      && (location === "ALL" || job.location.toLowerCase().includes(location.toLowerCase()))
      && (employment === "ALL" || [...job.employmentType, ...job.contractType].some((type) => type.toLowerCase().includes(employment.toLowerCase())))
      && (discovered === "ALL" || (discovered === "TODAY" && age < 86_400_000) || (discovered === "WEEK" && age < 7 * 86_400_000))
      && (salaryFloor === 0 || (job.salaryMax ?? job.salaryMin ?? 0) >= salaryFloor);
  }).sort((a, b) => b.score - a.score), [jobs, now, minimumScore, query, recommendation, source, status, company, technology, seniority, location, employment, discovered, salaryFloor]);
  const sources = [...new Set(jobs.flatMap((job) => job.sources.map((item) => item.source)))];
  const companies = [...new Set(jobs.map((job) => job.company))].sort();
  const technologies = [...new Set(jobs.flatMap((job) => job.technologies))].sort();
  const locations = [...new Set((databaseLocations.length ? databaseLocations : jobs.map((job) => job.location)).map(locationLabel).filter(Boolean))].sort();

  return <main className="app-shell">
    <SiteHeader userName={userName} isAdmin={isAdmin} />
    <section className="hero">
      <div><p className="eyebrow">{new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()).toUpperCase()}</p><h1>Good morning, {userName.split(" ")[0]}.</h1><p className="muted">A short list of roles that deserve a closer look.</p></div>
      <div className="hero-actions"><span className="sync-status"><i className={databaseEnabled ? "sync-ready" : ""}/>{databaseEnabled ? "Database configured" : "Demo data · connect Neon to sync jobs"}</span></div>
    </section>
    <section className="stats-grid" aria-label="Job summary">
      <article className="stat-card"><span>New today</span><strong>{jobs.filter((job) => new Date(job.discoveredAt).toDateString() === today).length}</strong><small>across your sources</small></article>
      <article className="stat-card"><span><BriefcaseBusiness size={14}/> In your pipeline</span><strong>{pipeline}</strong><small>backend roles</small></article>
      <article className="stat-card"><span>Worth reviewing</span><strong>{review}</strong><small>PHP + Laravel backend</small></article>
      <article className="stat-card stat-highlight"><span><Flame size={14}/> Strong matches</span><strong>{strong}</strong><small>remote + salary target</small></article>
      <article className="stat-card"><span><CircleCheck size={14}/> Applied</span><strong>{applied}</strong><small>applied · interview · offer</small></article>
    </section>
    <section className="list-section">
      <div className="section-heading"><div><p className="eyebrow">YOUR SHORTLIST</p><h2>Jobs worth your time <span>{filtered.length}</span></h2></div><span className="quiet-note"><BriefcaseBusiness size={15}/> Apply manually, always</span></div>
      <div className="filters">
        <label className="search-box"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, company, skills…" aria-label="Search jobs"/></label>
        <select value={recommendation} onChange={(event) => setRecommendation(event.target.value)} aria-label="Recommendation"><option value="ALL">Any recommendation</option><option>APPLY</option><option>REVIEW</option><option value="MAYBE">PIPELINE</option><option>REJECT</option></select>
        <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Source"><option value="ALL">Any source</option>{sources.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select value={String(minimumScore)} onChange={(event) => setMinimumScore(Number(event.target.value))} aria-label="Minimum score"><option value="0">Any score</option><option value="50">Pipeline+</option><option value="70">Review+</option><option value="85">Strong matches</option></select>
        <select value={company} onChange={(event) => setCompany(event.target.value)} aria-label="Company"><option value="ALL">Any company</option>{companies.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={technology} onChange={(event) => setTechnology(event.target.value)} aria-label="Technology"><option value="ALL">Any technology</option>{technologies.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={seniority} onChange={(event) => setSeniority(event.target.value)} aria-label="Seniority"><option value="ALL">Any seniority</option>{["Senior", "Staff", "Lead", "Mid", "Junior"].map((value) => <option key={value}>{value}</option>)}</select>
        <select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Location"><option value="ALL">Any location</option>{locations.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select value={employment} onChange={(event) => setEmployment(event.target.value)} aria-label="Employment type"><option value="ALL">Any employment</option>{["Contract", "Freelance", "Full-time", "Part-time", "Intern"].map((value) => <option key={value}>{value}</option>)}</select>
        <select value={String(salaryFloor)} onChange={(event) => setSalaryFloor(Number(event.target.value))} aria-label="Minimum salary"><option value="0">Any salary</option><option value="25">25+ listed</option><option value="50">50+ listed</option><option value="75">75+ listed</option></select>
        <select value={discovered} onChange={(event) => setDiscovered(event.target.value)} aria-label="Date discovered"><option value="ALL">Any date</option><option value="TODAY">Discovered today</option><option value="WEEK">Last 7 days</option></select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="OPEN">Open jobs</option><option value="ALL">All statuses</option><option value="SAVED">Saved</option><option value="APPLIED">Applied</option><option value="INTERVIEW">Interview</option><option value="OFFER">Offer</option><option value="REJECTED">Rejected</option></select>
      </div>
      <div className="job-list">{filtered.length ? filtered.map((job) => <article className="job-card" key={job.id}>
        <div className={`score-badge ${scoreClass(job.score)}`}><strong>{job.score}</strong><small>{job.recommendation === "APPLY" ? "STRONG" : job.recommendation === "REVIEW" ? "REVIEW" : job.recommendation === "MAYBE" ? "PIPELINE" : "FIT"}</small></div>
        <div className="job-main"><div className="job-title-line"><Link href={`/jobs/${job.id}`} className="job-title">{job.title}</Link><span className={`recommendation recommendation-${job.recommendation.toLowerCase()}`}>{recommendationLabel(job.recommendation)}</span></div><p className="company-line">{job.company}<span>·</span>{job.location || job.remoteType}<span>·</span>{salaryLabel(job)}</p><div className="tech-tags">{job.technologies.slice(0, 7).map((technology) => <span key={technology}>{technology}</span>)}</div><div className="job-meta"><span>{job.sources.map((item) => item.source).join(" · ")} · Found {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(job.discoveredAt))}</span><div className="quick-actions"><a href={job.sources[0]?.url ?? job.url} target="_blank" rel="noreferrer">Apply <ArrowUpRight size={12}/></a>{databaseEnabled && <form action={updateJobAction}><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="status" value="REJECTED"/><button type="submit">Reject</button></form>}</div></div></div>
        <Link href={`/jobs/${job.id}`} className="card-arrow" aria-label={`View ${job.title}`}><ArrowUpRight size={19}/></Link>
      </article>) : <div className="empty-state"><h3>No jobs match those filters.</h3><p>Try lowering the score cutoff or changing your search.</p></div>}</div>
      <p className="attribution">Job data is sourced from the listed boards. {sources.includes("himalayas") && <>Himalayas listings are attributed to <a href="https://himalayas.app" target="_blank" rel="noreferrer">Himalayas</a>. </>}Please verify each role on its original listing before applying.</p>
    </section>
  </main>;
}
