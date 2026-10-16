import { getCurrentAppUser } from "@/lib/app-user";
import { getDashboardJobs, getJobLocations, getScoringProfile } from "@/lib/repository/jobs";
import { JobDashboard } from "@/components/job-dashboard";
import { hasDatabase } from "@/lib/repository/jobs";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentAppUser();
  const [jobs, locations, profile] = await Promise.all([getDashboardJobs(user?.id), getJobLocations(), getScoringProfile(user?.id)]);
  return <JobDashboard jobs={jobs} locations={locations} residenceCountry={user?.id ? profile.residenceCountry ?? "" : ""} userName={user?.name ?? "Developer"} isAdmin={user?.role === "admin"} isLoggedIn={!!user?.id} databaseEnabled={hasDatabase()} now={new Date().toISOString()} />;
}
