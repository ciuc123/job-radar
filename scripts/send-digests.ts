import { loadEnvConfig } from "@next/env";
async function main() {
  loadEnvConfig(process.cwd());
  const { sendDailyDigests } = await import("@/lib/notifications/digest");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to send digests");
  const count = await sendDailyDigests();
  console.info(JSON.stringify({ event: "email.digest_run_completed", sent: count, at: new Date().toISOString() }));
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
