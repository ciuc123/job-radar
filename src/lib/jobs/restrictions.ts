import { findCountries } from "@/lib/jobs/countries";

const COUNTRY_WORDS = "[A-Za-z][A-Za-z.'’ &-]{1,40}";
const TAIL = "([^.;:!?\\n]{1,70})";

// Each pattern captures the phrase that should name the permitted countries.
const phrasePatterns: RegExp[] = [
  // "we only hire from Germany", "only hiring candidates located in Spain", "only accepts applicants based in the US"
  new RegExp(`\\bonly\\s+(?:hir(?:e|es|ing)|accept(?:s|ing)?|consider(?:s|ing)?|recruit(?:s|ing)?)\\s+(?:candidates\\s+|applicants\\s+|people\\s+|talent\\s+|developers\\s+|engineers\\s+)?(?:who\\s+(?:are|live|reside)\\s+)?(?:from|in|within|located\\s+in|based\\s+in|residing\\s+in|living\\s+in|residents\\s+of)\\s+${TAIL}`, "gi"),
  // "open only to candidates in Canada", "available only to residents of France"
  new RegExp(`\\b(?:open|available|restricted|limited)\\s+(?:only\\s+)?to\\s+(?:candidates|applicants|residents|people)?\\s*(?:located\\s+|based\\s+|residing\\s+|living\\s+)?(?:in|from|of)\\s+${TAIL}\\s+only\\b`, "gi"),
  new RegExp(`\\bonly\\s+(?:open|available)\\s+(?:to|for|in)\\s+(?:candidates\\s+|applicants\\s+|residents\\s+)?(?:located\\s+|based\\s+|residing\\s+)?(?:in\\s+|of\\s+|from\\s+)?${TAIL}`, "gi"),
  // "hiring in Poland only", "candidates from Brazil only"
  new RegExp(`\\b(?:hir(?:e|es|ing)|candidates|applicants|residents)\\s+(?:located\\s+|based\\s+)?(?:from|in)\\s+(${COUNTRY_WORDS}?)\\s+only\\b`, "gi"),
  // "must be located in the US", "must reside in Germany", "must be based in Canada or the US"
  new RegExp(`\\bmust\\s+(?:currently\\s+)?(?:be|reside|live)\\s+(?:legally\\s+)?(?:located\\s+|based\\s+|resident\\s+|residing\\s+|living\\s+|authori[sz]ed\\s+to\\s+work\\s+)?(?:in|within)\\s+${TAIL}`, "gi"),
];

// "US only", "Canada-only", "UK based only", "India only role"
const countryOnly = new RegExp(`(?<![\\p{L}])(${COUNTRY_WORDS}?)[\\s-]+(?:based\\s+|residents?\\s+|candidates\\s+)?only\\b`, "giu");

/**
 * Countries a listing says it exclusively hires from ("Only hires from X", "X only", "must be located in X").
 * Returns [] when the text does not restrict hiring to specific countries. Regions (e.g. "Europe") are not reported.
 */
export function detectHiringRestriction(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of phrasePatterns) {
    for (const match of text.matchAll(pattern)) for (const country of findCountries(match[1])) found.add(country);
  }
  // The "X only" form needs the country to sit directly before "only", so check just the last words captured.
  for (const match of text.matchAll(countryOnly)) {
    const words = match[1].trim().split(/\s+/).slice(-3).join(" ");
    for (const country of findCountries(words)) found.add(country);
  }
  return [...found].sort();
}
