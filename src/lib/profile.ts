import type { ScoringProfile } from "@/lib/types";

export const defaultProfile: ScoringProfile = {
  headline: "Senior backend developer · Laravel specialist",
  experienceYears: 14,
  experienceSummary: "14 years of PHP experience with Laravel, AWS and Docker in senior backend roles.",
  preferredTitles: ["Senior PHP Developer", "Senior Laravel Developer", "Senior Backend Developer", "Staff Backend Engineer", "Software Engineer", "Full-Stack Developer"],
  strongSkills: ["PHP", "Laravel", "Symfony", "MySQL", "Redis", "AWS", "Docker", "REST APIs", "Backend development", "Linux", "Nginx", "Composer"],
  secondarySkills: ["React", "Next.js", "JavaScript", "TypeScript", "Vite", "GitHub Actions", "CI/CD", "DevOps", "Java", "Domain Driven Design"],
  preferredLocations: ["Romania", "Europe", "EMEA", "CET", "Worldwide"],
  excludedLocations: ["US-only", "Canada-only", "India-only", "on-site", "relocation required"],
  preferredEmploymentTypes: ["contract", "freelance", "B2B", "full-time remote"],
  negativeSignals: ["junior", "internship", "entry-level", "graduate", "on-site only", "US-only", "Canada-only", "India-only", "relocation required", "legacy PHP maintenance"],
  salaryMinimum: null,
  thresholds: { apply: 85, review: 70, maybe: 50 },
  scoreWeights: {},
};
