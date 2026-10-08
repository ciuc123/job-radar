import { himalayasSource } from "@/lib/sources/himalayas";
import { laravelNewsSource } from "@/lib/sources/laravel-news";
import { wwrSource } from "@/lib/sources/wwr";
import { jobgetherSource } from "@/lib/sources/jobgether";
import type { JobSource } from "@/lib/sources/job-source";

const unavailable = (id: string, name: string, reason: string): JobSource => ({ id, name, enabled: false, available: false, unavailableReason: reason, async fetch() { throw new Error(reason); } });
const unavailableSources = [
  unavailable("proxify", "Proxify", "No reliable official public job feed has been verified."),
  unavailable("remote-rocketship", "Remote Rocketship", "No reliable official public job feed has been verified."),
  unavailable("remotive", "Remotive", "Automated extraction requires permission under its published terms."),
  unavailable("landing-jobs", "Landing.jobs", "No reliable official public job feed has been verified."),
  unavailable("working-nomads", "Working Nomads", "No documented public feed has been verified; unofficial endpoints are not used."),
  unavailable("authentic-jobs", "Authentic Jobs", "No reliable official public job feed has been verified."),
  unavailable("eu-remote-jobs", "EU Remote Jobs", "No reliable official public job feed has been verified."),
];

const additionalUnavailableSources = [
  unavailable("larajobs", "LaraJobs", "Public listings and weekly email are available; no documented public jobs API or feed has been verified."),
  unavailable("wearedevelopers", "WeAreDevelopers", "No documented public jobs API or jobs feed has been verified."),
  unavailable("techprojectsnow", "TechProjectsNow", "No documented public jobs API or feed has been verified."),
  unavailable("ateam", "A.Team", "Talent network; no permitted public jobs feed has been verified."),
  unavailable("upstack", "Upstack", "Talent network; no permitted public jobs feed has been verified."),
  unavailable("lemonio", "Lemon.io", "Talent network and waitlist; no permitted public jobs feed has been verified."),
  unavailable("toptal", "Toptal", "Talent network; no permitted public jobs feed has been verified."),
  unavailable("arcdev", "Arc.dev", "No documented public jobs API or feed has been verified."),
  unavailable("developersshore", "Developers Shore", "Community and opportunity updates are not exposed through a verified public jobs feed."),
  unavailable("gunio", "Gun.io", "Talent network; no permitted public jobs feed has been verified."),
  unavailable("matchdev", "Match.dev", "Talent network and waitlist; no permitted public jobs feed has been verified."),
  unavailable("turing", "Turing", "No documented public jobs API or feed has been verified."),
  unavailable("andela", "Andela", "Talent network; no permitted public jobs feed has been verified."),
  unavailable("contra", "Contra", "No documented public jobs API or feed has been verified."),
  unavailable("braintrust", "Braintrust", "No documented public jobs API or feed has been verified."),
  unavailable("upwork", "Upwork", "No documented public jobs API or feed has been verified."),
  unavailable("wellfound", "Wellfound", "No documented public jobs API or feed has been verified."),
  unavailable("calyptus", "Calyptus", "No documented public jobs API or feed has been verified."),
  unavailable("xteam", "X-Team", "No documented public jobs API or feed has been verified."),
  unavailable("farcoder", "FarCoder", "No documented public jobs API or feed has been verified."),
];

export const sourceRegistry: JobSource[] = [himalayasSource, laravelNewsSource, wwrSource, jobgetherSource, ...unavailableSources, ...additionalUnavailableSources];
export function getSource(id: string) { return sourceRegistry.find((source) => source.id === id); }
