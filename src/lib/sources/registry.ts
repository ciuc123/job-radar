import { himalayasSource } from "@/lib/sources/himalayas";
import { laravelNewsSource } from "@/lib/sources/laravel-news";
import { wwrSource } from "@/lib/sources/wwr";
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

export const sourceRegistry: JobSource[] = [himalayasSource, laravelNewsSource, wwrSource, ...unavailableSources];
export function getSource(id: string) { return sourceRegistry.find((source) => source.id === id); }
