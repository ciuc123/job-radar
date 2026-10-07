export type Recommendation = "APPLY" | "REVIEW" | "MAYBE" | "REJECT";
export type JobStatus = "NEW" | "SAVED" | "REVIEW" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED" | "WITHDRAWN";

export type NormalizedJob = {
  source: string;
  sourceJobId?: string;
  url: string;
  title: string;
  company: string;
  description: string;
  location: string;
  countries: string[];
  timezoneRequirements: string[];
  employmentType: string[];
  contractType: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  technologies: string[];
  seniority: string;
  postedAt?: string;
  expiresAt?: string;
  remoteType: string;
  rawData: unknown;
};

export type ScoringProfile = {
  strongSkills: string[];
  secondarySkills: string[];
  preferredLocations: string[];
  excludedLocations: string[];
  preferredEmploymentTypes: string[];
  salaryMinimum: number | null;
  thresholds: { apply: number; review: number; maybe: number };
};

export type ScoredJob = NormalizedJob & {
  score: number;
  scoreBreakdown: Record<string, number>;
  recommendation: Recommendation;
};
