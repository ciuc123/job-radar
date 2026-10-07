import { sendDailyDigests } from "@/lib/notifications/digest";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to send digests");
const count = await sendDailyDigests();
console.info(JSON.stringify({ event: "email.digest_run_completed", sent: count, at: new Date().toISOString() }));
