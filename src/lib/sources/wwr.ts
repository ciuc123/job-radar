import { XMLParser } from "fast-xml-parser";
import { normalizeJob } from "@/lib/jobs/normalize";
import type { NormalizedJob } from "@/lib/types";
import type { JobSource } from "@/lib/sources/job-source";

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
const asArray = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

export function mapWwrFeed(xml: string): NormalizedJob[] {
  const parsed = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  const channel = parsed.rss?.channel;
  if (!channel) throw new Error("We Work Remotely returned an invalid RSS feed");
  return asArray(channel.item as Record<string, unknown>[] | Record<string, unknown> | undefined).flatMap((item) => {
    const title = String(item.title ?? "").trim();
    const url = String(item.link ?? "").trim();
    if (!title || !url) return [];
    const split = title.match(/^(.+?):\s*(.+)$/);
    const description = String(item.description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const categories = asArray(item.category as string | string[] | undefined).map(String);
    return [normalizeJob({ source: "we-work-remotely", sourceJobId: String(item.guid ?? url), url, title: split?.[2] ?? title, company: split?.[1] ?? "Unknown company", description, location: "Remote", countries: [], timezoneRequirements: [], employmentType: [], contractType: [], technologies: categories, seniority: "Unknown", postedAt: item.pubDate ? new Date(String(item.pubDate)).toISOString() : undefined, remoteType: "Remote", rawData: item })];
  });
}

export const wwrSource: JobSource = {
  id: "we-work-remotely", name: "We Work Remotely", enabled: true, available: true,
  async fetch() {
    const response = await fetch("https://weworkremotely.com/remote-jobs.rss", { headers: { accept: "application/rss+xml, application/xml", "user-agent": "JobRadar/1.0 (personal job discovery)" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!response.ok) throw new Error(`We Work Remotely returned HTTP ${response.status}`);
    return { source: this.id, jobs: mapWwrFeed(await response.text()) };
  },
};
