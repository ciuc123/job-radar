"use server";

import { hasPaidFeature, requireAppUser } from "@/lib/app-user";
import { db } from "@/db";
import { networkPipelines, notificationSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getScoringProfile, rescoreJobs, saveProfile, updateJobApplication } from "@/lib/repository/jobs";
import { canonicalCountry } from "@/lib/jobs/countries";
import type { JobStatus } from "@/lib/types";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { analyzeJobForUser } from "@/lib/ai/analyzer";
import { lastFetchStartedAt, manualFetchCooldownMs, runFetchPipeline } from "@/lib/sources/pipeline";
import { sourceRegistry } from "@/lib/sources/registry";
import { AiBudgetError } from "@/lib/ai/usage";
import { AiRefusalError } from "@/lib/ai/client";
import { copilotEnabled } from "@/lib/ai/config";
import { deleteProfileDraft, draftProfileFromCv, getProfileDraft, saveProfileDraft } from "@/lib/ai/profile-copilot";
import { explainScore, validateSuggestions, type ScoreExplanation } from "@/lib/ai/score-explainer";

export async function updateJobAction(formData: FormData) {
  const { id: userId } = await requireAppUser();
  const jobId = String(formData.get("jobId") ?? "");
  const status = String(formData.get("status") ?? "NEW") as JobStatus;
  const noteValue = formData.get("notes");
  const notes = noteValue === null ? undefined : String(noteValue);
  if (!jobId || !["NEW", "SAVED", "REVIEW", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"].includes(status)) throw new Error("Invalid application update");
  await updateJobApplication(userId, jobId, status, notes);
  redirect(`/jobs/${jobId}`);
}

export async function saveProfileAction(formData: FormData) {
  const { id: userId } = await requireAppUser();
  const list = (key: string) => String(formData.get(key) ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const parseThreshold = (key: string, fallback: number) => {
    const value = Number(formData.get(key));
    return Number.isInteger(value) && value >= 0 && value <= 100 ? value : fallback;
  };
  const years = Number(formData.get("experienceYears") ?? 0);
  const salaryMinimumValue = formData.get("salaryMinimum");
  const salaryMinimum = salaryMinimumValue ? Number(salaryMinimumValue) : null;
  if (!Number.isFinite(years) || !Number.isFinite(salaryMinimum ?? 0)) throw new Error("Experience and salary must be valid numbers");
  let scoreWeights: Record<string, number> = {};
  try {
    const parsed = JSON.parse(String(formData.get("scoreWeights") || "{}")) as Record<string, unknown>;
    scoreWeights = Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 100) as Array<[string, number]>);
  } catch { throw new Error("Scoring weights must be valid JSON"); }
  const thresholds = { apply: parseThreshold("applyThreshold", 85), review: parseThreshold("reviewThreshold", 70), maybe: parseThreshold("maybeThreshold", 50) };
  if (!(thresholds.apply > thresholds.review && thresholds.review > thresholds.maybe)) throw new Error("Thresholds must be ordered: Apply above Review above Pipeline");
  await saveProfile(userId, {
    headline: String(formData.get("headline") ?? "").trim(),
    experienceYears: Math.max(0, Math.min(60, years)),
    experienceSummary: String(formData.get("experienceSummary") ?? "").trim(),
    preferredTitles: list("preferredTitles"),
    strongSkills: list("strongSkills"), secondarySkills: list("secondarySkills"),
    preferredLocations: list("preferredLocations"), excludedLocations: list("excludedLocations"),
    residenceCountry: canonicalCountry(String(formData.get("residenceCountry") ?? "")) ?? "",
    preferredEmploymentTypes: list("preferredEmploymentTypes"), negativeSignals: list("negativeSignals"),
    salaryMinimum,
    thresholds, scoreWeights,
  });
  await rescoreJobs(await getScoringProfile(userId), userId);
  redirect("/settings?updated=1");
}

export async function saveNetworkPipelineAction(formData: FormData) {
  const { id: userId } = await requireAppUser();
  if (!db) throw new Error("Database is not configured");
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "FOLLOW_UP");
  if (!name || !["FOLLOW_UP", "IN_PROGRESS", "WAITING", "READY", "PAUSED", "CLOSED"].includes(status)) throw new Error("Invalid tracker entry");
  await db.insert(networkPipelines).values({ userId, name, status, cadence: String(formData.get("cadence") ?? "").trim() || null, nextAction: String(formData.get("nextAction") ?? "").trim() || null, notes: String(formData.get("notes") ?? "").trim() })
    .onConflictDoUpdate({ target: [networkPipelines.userId, networkPipelines.name], set: { status, cadence: String(formData.get("cadence") ?? "").trim() || null, nextAction: String(formData.get("nextAction") ?? "").trim() || null, notes: String(formData.get("notes") ?? "").trim(), updatedAt: new Date() } });
  redirect("/network");
}

export async function saveNotificationSettingsAction(formData: FormData) {
  const { id: userId } = await requireAppUser();
  if (!db) throw new Error("Database is not configured");
  const threshold = Number(formData.get("immediateThreshold"));
  if (!Number.isInteger(threshold) || threshold < 50 || threshold > 100) throw new Error("Notification threshold must be from 50 to 100");
  const values = { dailyDigestEnabled: formData.get("dailyDigestEnabled") === "on", immediateEnabled: formData.get("immediateEnabled") === "on", immediateThreshold: threshold };
  if ((values.dailyDigestEnabled || values.immediateEnabled) && !(await hasPaidFeature("email_alerts"))) throw new Error("Email alerts require the Pro plan");
  await db.update(notificationSettings).set(values).where(eq(notificationSettings.userId, userId));
  redirect("/settings?notifications=updated");
}

async function requireAiAccess() {
  const user = await requireAppUser();
  if (!copilotEnabled()) throw new Error("AI features are not enabled");
  if (!(await hasPaidFeature("ai_analysis"))) throw new Error("AI features require the Pro plan or beta access");
  return user;
}

const aiErrorCode = (error: unknown) => error instanceof AiBudgetError ? "limit" : error instanceof AiRefusalError ? "refused" : "error";

export async function generateProfileDraftAction(formData: FormData) {
  const { id: userId } = await requireAiAccess();
  if (formData.get("consent") !== "on") redirect("/settings?ai=consent");
  let outcome = "drafted";
  try {
    await saveProfileDraft(userId, await draftProfileFromCv(userId, String(formData.get("cv") ?? "")));
  } catch (error) {
    console.error(JSON.stringify({ event: "ai.profile_draft_failed", userId, error: error instanceof Error ? error.message : "unknown" }));
    outcome = error instanceof Error && /^(Paste at least|CV text is too long)/.test(error.message) ? "invalid" : aiErrorCode(error);
  }
  redirect(`/settings?ai=${outcome}`);
}

export async function acceptProfileDraftAction() {
  const { id: userId } = await requireAiAccess();
  const draft = await getProfileDraft(userId);
  if (!draft) redirect("/settings?ai=missing");
  const current = await getScoringProfile(userId);
  // Keep the user's own thresholds; the draft only proposes skills, titles, locations, weights and the rubric.
  const profile = { ...draft.profile, thresholds: current.thresholds };
  await saveProfile(userId, profile);
  await rescoreJobs(await getScoringProfile(userId), userId);
  await deleteProfileDraft(userId);
  redirect("/settings?ai=accepted");
}

export async function discardProfileDraftAction() {
  const { id: userId } = await requireAiAccess();
  await deleteProfileDraft(userId);
  redirect("/settings?ai=discarded");
}

export type ExplainState = { explanation?: ScoreExplanation; error?: string } | null;

export async function explainScoreAction(_previous: ExplainState, formData: FormData): Promise<ExplainState> {
  const { id: userId } = await requireAiAccess();
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return { error: "Missing job" };
  try {
    return { explanation: await explainScore(userId, jobId) };
  } catch (error) {
    console.error(JSON.stringify({ event: "ai.explain_failed", userId, jobId, error: error instanceof Error ? error.message : "unknown" }));
    return { error: error instanceof AiBudgetError ? error.message : "The explanation could not be generated. Try again later." };
  }
}

export async function applyWeightSuggestionAction(formData: FormData) {
  const { id: userId } = await requireAiAccess();
  const jobId = String(formData.get("jobId") ?? "");
  const profile = await getScoringProfile(userId);
  const [suggestion] = validateSuggestions([{ weightKey: String(formData.get("weightKey") ?? ""), suggestedWeight: Number(formData.get("suggestedWeight")), reason: "" }], profile);
  if (!suggestion) throw new Error("Invalid weight suggestion");
  await saveProfile(userId, { ...profile, scoreWeights: { ...profile.scoreWeights, [suggestion.weightKey]: suggestion.suggested } });
  await rescoreJobs(await getScoringProfile(userId), userId);
  redirect(jobId ? `/jobs/${jobId}` : "/");
}

export type AnalyzeJobState = { error?: string };

export async function analyzeJobAction(_state: AnalyzeJobState, formData: FormData): Promise<AnalyzeJobState> {
  const { id: userId } = await requireAppUser();
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId || jobId.startsWith("demo-")) return { error: "This job can't be analyzed." };
  if (!(await hasPaidFeature("ai_analysis"))) return { error: "AI analysis requires the Pro plan." };
  const result = await analyzeJobForUser(userId, jobId);
  if (result.status === "error") return { error: result.error };
  revalidatePath(`/jobs/${jobId}`);
  return {};
}

export type FetchAllState = { error?: string; summary?: string };

// Pro: run every enabled source now instead of waiting for the twice-daily schedule. The job corpus is shared,
// so a cooldown (any user, or the scheduled run) protects the upstream feeds and the database.
export async function fetchAllSourcesAction(_state: FetchAllState, _formData: FormData): Promise<FetchAllState> {
  const { id: userId } = await requireAppUser();
  if (!db) return { error: "Demo mode is read-only." };
  if (!(await hasPaidFeature("source_refresh"))) return { error: "Fetching all sources on demand requires the Pro plan." };
  const lastStarted = await lastFetchStartedAt();
  const waitMs = lastStarted ? lastStarted.getTime() + manualFetchCooldownMs() - Date.now() : 0;
  if (waitMs > 0) return { error: `Sources were fetched recently. Try again in ${Math.ceil(waitMs / 60_000)} min.` };
  const started = Date.now();
  const runs = await runFetchPipeline(sourceRegistry, { analyze: false });
  const failed = runs.filter((run) => !run.ok);
  const added = runs.reduce((total, run) => total + run.added, 0);
  console.info(JSON.stringify({ event: "fetch.manual_completed", userId, sources: runs.length, failed: failed.length, added, durationMs: Date.now() - started }));
  revalidatePath("/sources");
  revalidatePath("/");
  return { summary: `Fetched ${runs.length - failed.length}/${runs.length} sources · ${added} new job${added === 1 ? "" : "s"}${failed.length ? ` · failed: ${failed.map((run) => run.source).join(", ")}` : ""}.` };
}
