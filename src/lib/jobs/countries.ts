const COUNTRY_NAMES = [
  "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahrain", "Bangladesh", "Belarus", "Belgium", "Bolivia",
  "Bosnia and Herzegovina", "Brazil", "Bulgaria", "Cambodia", "Canada", "Chile", "China", "Colombia", "Costa Rica", "Croatia", "Cyprus",
  "Czech Republic", "Denmark", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Estonia", "Ethiopia", "Finland", "France", "Georgia",
  "Germany", "Ghana", "Greece", "Guatemala", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Ireland", "Israel", "Italy",
  "Japan", "Jordan", "Kazakhstan", "Kenya", "Kosovo", "Latvia", "Lithuania", "Luxembourg", "Malaysia", "Malta", "Mexico", "Moldova", "Montenegro",
  "Morocco", "Netherlands", "New Zealand", "Nigeria", "North Macedonia", "Norway", "Pakistan", "Panama", "Paraguay", "Peru", "Philippines",
  "Poland", "Portugal", "Puerto Rico", "Qatar", "Romania", "Saudi Arabia", "Serbia", "Singapore", "Slovakia", "Slovenia", "South Africa",
  "South Korea", "Spain", "Sri Lanka", "Sweden", "Switzerland", "Taiwan", "Thailand", "Tunisia", "Turkey", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Venezuela", "Vietnam",
];

// Lower-cased alias -> canonical name. Short ambiguous aliases (US, UK, UAE) are matched case-sensitively in free text.
const ALIASES: Record<string, string> = {
  usa: "United States", "u.s.": "United States", "u.s.a.": "United States", us: "United States", america: "United States", "united states of america": "United States",
  uk: "United Kingdom", "u.k.": "United Kingdom", "great britain": "United Kingdom", britain: "United Kingdom", england: "United Kingdom", scotland: "United Kingdom", wales: "United Kingdom", "northern ireland": "United Kingdom",
  uae: "United Arab Emirates", czechia: "Czech Republic", "republic of korea": "South Korea", korea: "South Korea", turkiye: "Turkey", "türkiye": "Turkey",
  holland: "Netherlands", "the netherlands": "Netherlands", "republic of ireland": "Ireland", "viet nam": "Vietnam", "russian federation": "Russia", russia: "Russia",
  "bosnia & herzegovina": "Bosnia and Herzegovina", bosnia: "Bosnia and Herzegovina", macedonia: "North Macedonia", brasil: "Brazil",
};

// Regions are kept as their own entries: they are not countries, but they are useful to show and filter on.
export const REGIONS = ["Europe", "EMEA", "EU", "Worldwide", "Global", "Anywhere", "APAC", "LATAM", "Latin America", "North America", "Asia", "Africa", "Middle East", "Americas", "Oceania"];

const byLower = new Map<string, string>([
  ...COUNTRY_NAMES.map((name) => [name.toLowerCase(), name] as [string, string]),
  ...Object.entries(ALIASES),
  ...REGIONS.map((name) => [name.toLowerCase(), name] as [string, string]),
]);
const regionSet = new Set(REGIONS.map((name) => name.toLowerCase()));
const CASE_SENSITIVE_ALIASES = new Set(["us", "uk", "uae", "usa"]);

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const countryTerms = [...COUNTRY_NAMES.map((name) => name.toLowerCase()), ...Object.keys(ALIASES).filter((alias) => !CASE_SENSITIVE_ALIASES.has(alias))].sort((a, b) => b.length - a.length);
const namePattern = new RegExp(`(?<![\\p{L}])(${countryTerms.map(escape).join("|")})(?![\\p{L}])`, "giu");
const shortPattern = /(?<![A-Za-z.])(USA|US|U\.S\.A?\.?|UK|U\.K\.|UAE)(?![A-Za-z])/g;

/** Canonical country/region for a single name ("USA" -> "United States"), or undefined if not recognised. */
export function canonicalCountry(value: string): string | undefined {
  const key = value.trim().replace(/^the\s+/i, "").toLowerCase();
  return byLower.get(key);
}

export const isRegion = (value: string) => regionSet.has(value.toLowerCase());

/** Every country mentioned in a free-text phrase, canonical and de-duplicated (regions are not included). */
export function findCountries(phrase: string): string[] {
  const found = new Set<string>();
  for (const match of phrase.matchAll(namePattern)) {
    const name = canonicalCountry(match[1]);
    if (name) found.add(name);
  }
  for (const match of phrase.matchAll(shortPattern)) {
    const name = canonicalCountry(match[1].replace(/\.$/, ""));
    if (name) found.add(name);
  }
  return [...found];
}

const SEPARATORS = /[,;/|]+|\s+\|\s+/;

/**
 * One entry per country. Sources hand us either an array that may itself contain "Germany, France" or a
 * comma-joined location string; both are split and mapped to canonical names. Unrecognised parts from `countries`
 * are kept as given (sources know best); the location string is only trusted when its parts are recognised.
 */
export function normalizeCountries(countries: string[], location = ""): string[] {
  const result = new Set<string>();
  const add = (part: string, strict: boolean) => {
    const cleaned = part.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    const canonical = canonicalCountry(cleaned);
    if (canonical) result.add(canonical);
    else if (!strict) result.add(cleaned);
  };
  for (const entry of countries) if (typeof entry === "string") for (const part of entry.split(SEPARATORS)) add(part, false);
  if (!result.size) for (const part of location.split(SEPARATORS)) add(part, true);
  return [...result];
}
