import type { ScoringProfile } from "@/lib/types";

export const defaultProfile: ScoringProfile = {
  strongSkills: ["PHP", "Laravel", "Symfony", "MySQL", "Redis", "AWS", "Docker", "REST APIs", "Backend development", "Linux", "Nginx", "Composer"],
  secondarySkills: ["React", "Next.js", "JavaScript", "TypeScript", "Vite", "GitHub Actions", "CI/CD", "DevOps", "Java", "Domain Driven Design"],
  preferredLocations: ["Romania", "Europe", "EMEA", "CET", "Worldwide"],
  excludedLocations: ["US-only", "Canada-only", "India-only", "on-site", "relocation required"],
  preferredEmploymentTypes: ["contract", "freelance", "B2B", "full-time remote"],
  salaryMinimum: null,
  thresholds: { apply: 85, review: 70, maybe: 50 },
};
