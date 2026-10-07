import { boolean, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const recommendationEnum = pgEnum("recommendation", ["APPLY", "REVIEW", "MAYBE", "REJECT"]);
export const applicationStatusEnum = pgEnum("application_status", ["NEW", "SAVED", "REVIEW", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  image: text("image"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [uniqueIndex("accounts_provider_user_unique").on(table.provider, table.providerAccountId)]);

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (table) => [uniqueIndex("verification_tokens_identity_unique").on(table.identifier, table.token)]);

export const candidateProfiles = pgTable("candidate_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  headline: text("headline").notNull().default(""),
  experienceYears: integer("experience_years").notNull().default(0),
  experienceSummary: text("experience_summary").notNull().default(""),
  preferredTitles: jsonb("preferred_titles").$type<string[]>().notNull().default([]),
  strongSkills: jsonb("strong_skills").$type<string[]>().notNull(),
  secondarySkills: jsonb("secondary_skills").$type<string[]>().notNull(),
  preferredLocations: jsonb("preferred_locations").$type<string[]>().notNull(),
  excludedLocations: jsonb("excluded_locations").$type<string[]>().notNull(),
  preferredEmploymentTypes: jsonb("preferred_employment_types").$type<string[]>().notNull(),
  negativeSignals: jsonb("negative_signals").$type<string[]>().notNull().default([]),
  salaryMinimum: integer("salary_minimum"),
  thresholds: jsonb("thresholds").$type<{ apply: number; review: number; maybe: number }>().notNull(),
  scoreWeights: jsonb("score_weights").$type<Record<string, number>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  canonicalUrl: text("canonical_url").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull().default(""),
  countries: jsonb("countries").$type<string[]>().notNull().default([]),
  timezoneRequirements: jsonb("timezone_requirements").$type<string[]>().notNull().default([]),
  employmentType: jsonb("employment_type").$type<string[]>().notNull().default([]),
  contractType: jsonb("contract_type").$type<string[]>().notNull().default([]),
  salaryMin: real("salary_min"),
  salaryMax: real("salary_max"),
  salaryCurrency: varchar("salary_currency", { length: 8 }),
  salaryPeriod: varchar("salary_period", { length: 32 }),
  technologies: jsonb("technologies").$type<string[]>().notNull().default([]),
  seniority: varchar("seniority", { length: 64 }).notNull().default("Unknown"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  remoteType: varchar("remote_type", { length: 64 }).notNull().default("Unknown"),
  rawData: jsonb("raw_data").notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  score: integer("score").notNull().default(0),
  scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>().notNull().default({}),
  recommendation: recommendationEnum("recommendation").notNull().default("REJECT"),
  immediateSentAt: timestamp("immediate_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("jobs_canonical_url_unique").on(table.canonicalUrl),
  uniqueIndex("jobs_content_hash_unique").on(table.contentHash),
]);

export const sourceListings = pgTable("source_listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  source: varchar("source", { length: 80 }).notNull(),
  sourceJobId: text("source_job_id"),
  url: text("url").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("source_listing_source_id_unique").on(table.source, table.sourceJobId),
  uniqueIndex("source_listing_url_unique").on(table.source, table.url),
]);

export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  status: applicationStatusEnum("status").notNull().default("NEW"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  interviewDates: jsonb("interview_dates").$type<string[]>().notNull().default([]),
  notes: text("notes").notNull().default(""),
  cvVersion: text("cv_version"),
  coverLetter: text("cover_letter"),
  salaryExpectation: integer("salary_expectation"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  nextAction: text("next_action"),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("application_user_job_unique").on(table.userId, table.jobId)]);

export const sourceHealth = pgTable("source_health", {
  source: varchar("source", { length: 80 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  available: boolean("available").notNull().default(true),
  status: varchar("status", { length: 24 }).notNull().default("idle"),
  lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
  lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }),
  discovered: integer("discovered").notNull().default(0),
  added: integer("added").notNull().default(0),
  duplicates: integer("duplicates").notNull().default(0),
  durationMs: integer("duration_ms"),
  lastError: text("last_error"),
});

export const aiAnalyses = pgTable("ai_analyses", {
  jobId: uuid("job_id").primaryKey().references(() => jobs.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  recommendation: recommendationEnum("recommendation").notNull(),
  summary: text("summary").notNull(),
  matches: jsonb("matches").$type<string[]>().notNull(),
  gaps: jsonb("gaps").$type<string[]>().notNull(),
  concerns: jsonb("concerns").$type<string[]>().notNull(),
  estimatedFit: varchar("estimated_fit", { length: 32 }).notNull(),
  model: text("model"),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationSettings = pgTable("notification_settings", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dailyDigestEnabled: boolean("daily_digest_enabled").notNull().default(false),
  immediateEnabled: boolean("immediate_enabled").notNull().default(false),
  immediateThreshold: integer("immediate_threshold").notNull().default(92),
  lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),
});

export const networkPipelines = pgTable("network_pipelines", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: varchar("status", { length: 48 }).notNull().default("FOLLOW_UP"),
  cadence: varchar("cadence", { length: 32 }),
  nextAction: text("next_action"),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  history: jsonb("history").$type<Array<{ at?: string; text: string; url?: string }>>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("network_pipeline_user_name_unique").on(table.userId, table.name)]);
