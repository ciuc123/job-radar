import { createHash } from "node:crypto";
import type { ScoringProfile } from "@/lib/types";

const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]))
  : value;

/** Fingerprint of everything in a profile that can change a score or an analysis; used to detect stale AI results. */
export function profileHash(profile: ScoringProfile): string {
  return createHash("sha256").update(JSON.stringify(stable({ ...profile, rubric: profile.rubric ?? null }))).digest("hex").slice(0, 32);
}
