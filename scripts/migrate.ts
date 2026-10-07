import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Set it in .env or the environment.");
  await migrate(drizzle(neon(process.env.DATABASE_URL)), { migrationsFolder: "./drizzle" });
  console.info("Database migrations applied.");
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
