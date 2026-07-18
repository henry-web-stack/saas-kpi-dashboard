import { pgTable, serial, integer, numeric, text, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const monthlyMetricsTable = pgTable("monthly_metrics", {
  id: serial("id").primaryKey(),
  month: date("month").notNull().unique(),
  newUsers: integer("new_users").notNull().default(0),
  churnedUsers: integer("churned_users").notNull().default(0),
  totalUsers: integer("total_users").notNull().default(0),
  mrr: numeric("mrr", { precision: 12, scale: 2 }).notNull().default("0"),
  newMrr: numeric("new_mrr", { precision: 12, scale: 2 }).notNull().default("0"),
  expansionMrr: numeric("expansion_mrr", { precision: 12, scale: 2 }).notNull().default("0"),
  churnedMrr: numeric("churned_mrr", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const retentionCohortsTable = pgTable("retention_cohorts", {
  id: serial("id").primaryKey(),
  cohortMonth: date("cohort_month").notNull(),
  monthIndex: integer("month_index").notNull(),
  retentionRate: numeric("retention_rate", { precision: 5, scale: 2 }),
  cohortSize: integer("cohort_size").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriberStatusEnum = pgEnum("subscriber_status", ["active", "at_risk", "churned"]);
export const subscriberPlanEnum = pgEnum("subscriber_plan", ["starter", "growth", "enterprise"]);

export const subscribersTable = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  plan: subscriberPlanEnum("plan").notNull().default("starter"),
  status: subscriberStatusEnum("status").notNull().default("active"),
  mrr: numeric("mrr", { precision: 10, scale: 2 }).notNull().default("0"),
  joinedAt: date("joined_at").notNull(),
  churnedAt: date("churned_at"),
  tenureMonths: integer("tenure_months").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMonthlyMetricsSchema = createInsertSchema(monthlyMetricsTable).omit({ id: true, createdAt: true });
export const insertRetentionCohortSchema = createInsertSchema(retentionCohortsTable).omit({ id: true, createdAt: true });

export const insertSubscriberSchema = createInsertSchema(subscribersTable).omit({ id: true, createdAt: true });

export type InsertMonthlyMetrics = z.infer<typeof insertMonthlyMetricsSchema>;
export type MonthlyMetrics = typeof monthlyMetricsTable.$inferSelect;
export type InsertRetentionCohort = z.infer<typeof insertRetentionCohortSchema>;
export type RetentionCohort = typeof retentionCohortsTable.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type Subscriber = typeof subscribersTable.$inferSelect;
