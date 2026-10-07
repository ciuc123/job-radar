import { createHash } from "node:crypto";
import type { NormalizedJob } from "@/lib/types";

export function cleanHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"].forEach((key) => url.searchParams.delete(key));
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  } catch {
    return value.trim();
  }
}

export function parseSalary(value: unknown): { min?: number; max?: number; currency?: string; period?: string } {
  if (typeof value === "number" && Number.isFinite(value)) return { min: value };
  if (typeof value !== "string") return {};
  const normalized = value.replace(/,/g, "");
  const currency = normalized.match(/EUR|USD|GBP|CHF|CAD|AUD|RON|€|\$|£/i)?.[0];
  const numbers = [...normalized.matchAll(/\d+(?:\.\d+)?\s*[kK]?/g)].map((match) => {
    const raw = match[0].replace(/\s/g, "");
    return Number.parseFloat(raw) * (/k$/i.test(raw) ? 1000 : 1);
  });
  const period = /hour|\/h|hourly/i.test(value) ? "hourly" : /month|monthly|\/mo/i.test(value) ? "monthly" : /year|annual|annually|\/yr/i.test(value) ? "annual" : undefined;
  if (!numbers.length) return {};
  return { min: numbers[0], ...(numbers[1] ? { max: numbers[1] } : {}), ...(currency ? { currency: currency === "€" ? "EUR" : currency === "£" ? "GBP" : currency === "$" ? "USD" : currency.toUpperCase() } : {}), ...(period ? { period } : {}) };
}

const technologyPatterns: Array<[string, RegExp]> = [
  ["Laravel", /\blaravel\b/i], ["PHP", /\bphp\b/i], ["Symfony", /\bsymfony\b/i], ["MySQL", /\bmysql\b/i],
  ["Redis", /\bredis\b/i], ["AWS", /\baws\b|amazon web services/i], ["Docker", /\bdocker\b/i], ["REST APIs", /\brest(?:ful)?\s+api\b|\bapi development\b/i],
  ["React", /\breact(?:\.js)?\b/i], ["Next.js", /\bnext\.js\b/i], ["JavaScript", /\bjavascript\b/i], ["TypeScript", /\btypescript\b/i],
  ["Linux", /\blinux\b/i], ["Nginx", /\bnginx\b/i], ["Composer", /\bcomposer\b/i], ["Java", /\bjava\b/i], ["CI/CD", /\bci\s*\/\s*cd\b/i],
];

export function extractTechnologies(text: string): string[] {
  return technologyPatterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

export function contentHash(job: Pick<NormalizedJob, "title" | "company" | "description">): string {
  const normalized = `${job.company} ${job.title} ${cleanHtml(job.description)}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

export function descriptionHash(description: string): string {
  const normalized = cleanHtml(description).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

export function normalizeJob(job: NormalizedJob): NormalizedJob {
  const description = cleanHtml(job.description);
  return {
    ...job,
    url: normalizeUrl(job.url),
    title: job.title.trim().replace(/\s+/g, " "),
    company: job.company.trim().replace(/\s+/g, " "),
    description,
    location: job.location.trim(),
    countries: [...new Set(job.countries.map((item) => item.trim()).filter(Boolean))],
    timezoneRequirements: [...new Set(job.timezoneRequirements.map((item) => item.trim()).filter(Boolean))],
    technologies: [...new Set([...job.technologies, ...extractTechnologies(`${job.title} ${description}`)])],
  };
}
