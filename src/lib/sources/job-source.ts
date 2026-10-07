import type { NormalizedJob } from "@/lib/types";

export type SourceFetchResult = { jobs: NormalizedJob[]; source: string };
export type JobSource = {
  id: string;
  name: string;
  enabled: boolean;
  available: boolean;
  unavailableReason?: string;
  fetch(): Promise<SourceFetchResult>;
};

export class SourceFetchError extends Error {
  constructor(public readonly source: string, message: string) {
    super(message);
    this.name = "SourceFetchError";
  }
}

export async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "JobRadar/1.0 (personal job discovery)" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status} from source`);
  return response.json();
}
