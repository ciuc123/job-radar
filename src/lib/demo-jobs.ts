import type { NormalizedJob } from "@/lib/types";

export function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    source: "fixture", sourceJobId: undefined, url: "https://example.com/jobs/role", title: "Senior Backend Engineer",
    company: "Example Co", description: "Build and operate backend APIs for a remote engineering team.",
    location: "Remote Europe", countries: ["Romania"], timezoneRequirements: ["UTC+2"],
    employmentType: ["Full-time"], contractType: [], salaryMin: undefined, salaryMax: undefined,
    salaryCurrency: undefined, salaryPeriod: undefined, technologies: ["PHP", "Laravel"], seniority: "Senior",
    postedAt: undefined, expiresAt: undefined, remoteType: "Remote", rawData: {}, ...overrides,
  };
}

export const realisticJobs: NormalizedJob[] = [
  job({ title: "Senior Laravel Developer", company: "Acme", description: "Laravel and PHP are the core stack. Build REST APIs using AWS, Docker, Redis and MySQL. Remote Europe, contract.", technologies: ["Laravel", "PHP", "AWS", "Docker", "Redis", "MySQL", "REST APIs"], contractType: ["Contract"] }),
  job({ title: "Senior Backend Engineer — PHP", company: "Foo", description: "Develop PHP services with Symfony, MySQL and AWS for customers across EMEA.", technologies: ["PHP", "Symfony", "MySQL", "AWS"] }),
  job({ title: "Full Stack Laravel Engineer", company: "Bar", description: "Laravel is the main backend framework with React on the frontend. Remote worldwide.", technologies: ["Laravel", "PHP", "React"] }),
  job({ title: "PHP Engineer", company: "Baz", description: "Develop PHP APIs. Remote in Europe.", technologies: ["PHP", "REST APIs"] }),
  job({ title: "Staff Backend Engineer", company: "North", description: "Lead backend architecture with Laravel, PHP, Redis, AWS and Docker. CET remote contract.", technologies: ["Laravel", "PHP", "Redis", "AWS", "Docker"] }),
  job({ title: "Senior Java Backend Engineer", company: "JVM Co", description: "Build Java and Spring services. No PHP stack.", technologies: ["Java"] }),
  job({ title: "Junior Laravel Developer", company: "Start", description: "Entry-level role maintaining Laravel applications.", seniority: "Junior" }),
  job({ title: "Senior PHP Developer", company: "US Corp", description: "PHP backend role for candidates based in the United States only.", location: "US only", countries: ["United States"] }),
  job({ title: "Laravel Developer", company: "London Office", description: "Laravel role requiring five days a week in office.", location: "On-site London", remoteType: "On-site" }),
  job({ title: "Remote Anywhere PHP Developer", company: "Globex", description: "Build PHP and Laravel services from anywhere in the world.", location: "Worldwide", countries: [] }),
  job({ title: "PHP Contractor", company: "Contractors", description: "Contract PHP APIs, Laravel preferred. Remote Romania.", employmentType: ["Contract"], contractType: ["Freelance"] }),
  job({ title: "Full-time PHP Developer", company: "Permanent", description: "Full-time remote PHP role.", employmentType: ["Full-time"] }),
  job({ title: "Legacy PHP Maintenance Developer", company: "Old Stack", description: "PHP is only a legacy maintenance requirement. Mostly Java migration work.", technologies: ["Java", "PHP"] }),
  job({ title: "Graduate Software Engineer", company: "Grad", description: "Graduate program with training. On-site in Bucharest.", location: "On-site Bucharest", remoteType: "On-site" }),
  job({ title: "Laravel Intern", company: "Interns", description: "Internship for students learning Laravel.", employmentType: ["Internship"] }),
  job({ title: "Senior Symfony Developer", company: "Symfony Co", description: "Symfony, PHP, MySQL and Redis in a European team.", technologies: ["Symfony", "PHP", "MySQL", "Redis"] }),
  job({ title: "Backend API Developer", company: "APIs", description: "Design REST APIs with PHP, Docker and AWS.", technologies: ["PHP", "REST APIs", "Docker", "AWS"] }),
  job({ title: "React Engineer", company: "Frontend Co", description: "React and TypeScript front-end role. PHP is not used.", technologies: ["React", "TypeScript"] }),
  job({ title: "Senior Laravel Developer", company: "MoveCo", description: "Laravel and PHP backend. Relocation required to the US.", location: "Relocation required", countries: ["United States"] }),
  job({ title: "Senior PHP Engineer", company: "India Team", description: "PHP development. Candidates must be located in India only.", location: "India-only", countries: ["India"] }),
  job({ title: "Senior PHP Developer", company: "Canada Team", description: "Remote Canada only. PHP APIs.", location: "Canada-only", countries: ["Canada"] }),
  job({ title: "Senior Laravel Engineer", company: "Low Pay", description: "Laravel PHP role in Europe.", salaryMin: 10, salaryMax: 15, salaryCurrency: "EUR", salaryPeriod: "hourly" }),
  job({ title: "Senior Laravel Developer", company: "No Salary", description: "Laravel PHP backend role. Remote Europe.", salaryMin: undefined, salaryMax: undefined }),
  job({ title: "Senior PHP Developer", company: "Two Boards", description: "PHP REST backend in remote Europe.", source: "board-a", sourceJobId: "same-77", url: "https://jobs.example.com/opening/77" }),
  job({ title: "Senior PHP Developer", company: "Two Boards", description: "PHP REST backend in remote Europe.", source: "board-b", sourceJobId: "other-77", url: "https://mirror.example.com/job/77?utm_source=feed" }),
];
