import { auth } from "@/auth";
import { getDashboardJobs } from "@/lib/repository/jobs";
import { JobDashboard } from "@/components/job-dashboard";
import { hasDatabase } from "@/lib/repository/jobs";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const jobs = await getDashboardJobs(session?.user?.id);
  return <JobDashboard jobs={jobs} userName={session?.user?.name ?? "Developer"} databaseEnabled={hasDatabase()} now={new Date().toISOString()} />;
}
