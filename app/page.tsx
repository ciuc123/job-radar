import { getCurrentAppUser } from "@/lib/app-user";
import { getDashboardJobs } from "@/lib/repository/jobs";
import { JobDashboard } from "@/components/job-dashboard";
import { hasDatabase } from "@/lib/repository/jobs";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentAppUser();
  const jobs = await getDashboardJobs(user?.id);
  return <JobDashboard jobs={jobs} userName={user?.name ?? "Developer"} isAdmin={user?.role === "admin"} databaseEnabled={hasDatabase()} now={new Date().toISOString()} />;
}
