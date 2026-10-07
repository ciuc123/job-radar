import type { JobSource } from "@/lib/sources/job-source";

// Laravel News publishes general Laravel articles; its official job-board partner is
// LaraJobs, which has no documented public API/feed for listings. Do not scrape HTML.
export const laravelNewsSource: JobSource = {
  id: "laravel-news", name: "Laravel News Jobs", enabled: false, available: false,
  unavailableReason: "No documented public job listings API or feed found. The site points to LaraJobs; awaiting a permitted public feed/API.",
  async fetch() { return { source: this.id, jobs: [] }; },
};
