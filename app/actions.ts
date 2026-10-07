"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { networkPipelines } from "@/db/schema";
import { getScoringProfile, rescoreJobs, saveProfile, updateJobApplication } from "@/lib/repository/jobs";
import type { JobStatus } from "@/lib/types";
import { redirect } from "next/navigation";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required");
  return session.user.id;
}

export async function updateJobAction(formData: FormData) {
  const userId = await requireUserId();
  const jobId = String(formData.get("jobId") ?? "");
  const status = String(formData.get("status") ?? "NEW") as JobStatus;
  const noteValue = formData.get("notes");
  const notes = noteValue === null ? undefined : String(noteValue);
  if (!jobId || !["NEW", "SAVED", "REVIEW", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"].includes(status)) throw new Error("Invalid application update");
  await updateJobApplication(userId, jobId, status, notes);
  redirect(`/jobs/${jobId}`);
}

export async function saveProfileAction(formData: FormData) {
  const userId = await requireUserId();
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
  await saveProfile(userId, {
    headline: String(formData.get("headline") ?? "").trim(),
    experienceYears: Math.max(0, Math.min(60, years)),
    experienceSummary: String(formData.get("experienceSummary") ?? "").trim(),
    preferredTitles: list("preferredTitles"),
    strongSkills: list("strongSkills"), secondarySkills: list("secondarySkills"),
    preferredLocations: list("preferredLocations"), excludedLocations: list("excludedLocations"),
    preferredEmploymentTypes: list("preferredEmploymentTypes"), negativeSignals: list("negativeSignals"),
    salaryMinimum,
    thresholds: { apply: parseThreshold("applyThreshold", 85), review: parseThreshold("reviewThreshold", 70), maybe: parseThreshold("maybeThreshold", 50) }, scoreWeights,
  });
  await rescoreJobs(await getScoringProfile(userId));
  redirect("/settings?updated=1");
}

export async function saveNetworkPipelineAction(formData: FormData) {
  const userId = await requireUserId();
  if (!db) throw new Error("Database is not configured");
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "FOLLOW_UP");
  if (!name || !["FOLLOW_UP", "IN_PROGRESS", "WAITING", "READY", "PAUSED", "CLOSED"].includes(status)) throw new Error("Invalid tracker entry");
  await db.insert(networkPipelines).values({ userId, name, status, cadence: String(formData.get("cadence") ?? "").trim() || null, nextAction: String(formData.get("nextAction") ?? "").trim() || null, notes: String(formData.get("notes") ?? "").trim() })
    .onConflictDoUpdate({ target: [networkPipelines.userId, networkPipelines.name], set: { status, cadence: String(formData.get("cadence") ?? "").trim() || null, nextAction: String(formData.get("nextAction") ?? "").trim() || null, notes: String(formData.get("notes") ?? "").trim(), updatedAt: new Date() } });
  redirect("/network");
}
