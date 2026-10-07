import { migrate } from "drizzle-orm/neon-http/migrator";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
await migrate(drizzle(neon(process.env.DATABASE_URL)), { migrationsFolder: "./drizzle" });
console.info("Database migrations applied.");
