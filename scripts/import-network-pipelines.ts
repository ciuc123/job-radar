import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type Pipeline = { name: string; status: string; cadence?: string; nextAction?: string; notes: string };

async function main() {
  loadEnvConfig(process.cwd());
  const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Set ALLOWED_EMAIL to the account that owns these private tracker entries");
  const path = resolve(process.argv[2] || "private/network-pipelines.json");
  const entries = JSON.parse(await readFile(path, "utf8")) as Pipeline[];
  if (!Array.isArray(entries) || entries.some((entry) => !entry.name || !entry.status || typeof entry.notes !== "string")) {
    throw new Error(`Invalid network pipeline JSON: ${path}`);
  }
  const [{ db }, { users, networkPipelines }] = await Promise.all([import("@/db"), import("@/db/schema")]);
  if (!db) throw new Error("DATABASE_URL is required to import private tracker entries");
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`No registered user found for ALLOWED_EMAIL=${email}; sign in once before importing`);
  for (const entry of entries) {
    await db.insert(networkPipelines).values({
      userId: user.id, name: entry.name, status: entry.status,
      cadence: entry.cadence ?? null, nextAction: entry.nextAction ?? null, notes: entry.notes,
    }).onConflictDoUpdate({
      target: [networkPipelines.userId, networkPipelines.name],
      set: { status: entry.status, cadence: entry.cadence ?? null, nextAction: entry.nextAction ?? null, notes: entry.notes, updatedAt: new Date() },
    });
  }
  console.info(JSON.stringify({ event: "network_pipelines.imported", count: entries.length, user: email }));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
