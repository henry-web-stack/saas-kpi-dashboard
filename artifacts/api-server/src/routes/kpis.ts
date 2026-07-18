import { Router } from "express";
import { db } from "@workspace/db";
import { monthlyMetricsTable, retentionCohortsTable, subscribersTable } from "@workspace/db";
import { eq, gte, sql, ilike, and, or, asc, desc, count } from "drizzle-orm";

const router = Router();

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "last_30_days":
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case "last_90_days":
      return new Date(now.getFullYear(), now.getMonth() - 3, 1);
    case "last_6_months":
      return new Date(now.getFullYear(), now.getMonth() - 6, 1);
    case "last_24_months":
      return new Date(now.getFullYear(), now.getMonth() - 24, 1);
    case "all_time":
      return new Date(2020, 0, 1);
    case "last_12_months":
    default:
      return new Date(now.getFullYear(), now.getMonth() - 12, 1);
  }
}

// GET /api/kpis/summary
router.get("/summary", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "last_12_months";
  const periodStart = getPeriodStart(period);

  const rows = await db
    .select()
    .from(monthlyMetricsTable)
    .where(gte(monthlyMetricsTable.month, periodStart.toISOString().slice(0, 10)))
    .orderBy(monthlyMetricsTable.month);

  if (rows.length === 0) {
    res.json({
      totalUsers: 0, totalUsersChange: 0,
      mrr: 0, mrrChange: 0,
      churnRate: 0, churnRateChange: 0,
      nrr: 0, nrrChange: 0,
      newUsersThisPeriod: 0, churnedUsersThisPeriod: 0,
      avgRevenuePerUser: 0, avgRevenuePerUserChange: 0,
    });
    return;
  }

  const latest = rows[rows.length - 1];
  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
  const firstRow = rows[0];

  const totalUsers = latest.totalUsers;
  const prevTotalUsers = prev?.totalUsers ?? firstRow.totalUsers;
  const totalUsersChange = prevTotalUsers > 0
    ? ((totalUsers - prevTotalUsers) / prevTotalUsers) * 100
    : 0;

  const mrr = parseFloat(latest.mrr as string);
  const prevMrr = parseFloat((prev?.mrr ?? firstRow.mrr) as string);
  const mrrChange = prevMrr > 0 ? ((mrr - prevMrr) / prevMrr) * 100 : 0;

  const newUsersThisPeriod = rows.reduce((s, r) => s + r.newUsers, 0);
  const churnedUsersThisPeriod = rows.reduce((s, r) => s + r.churnedUsers, 0);

  // Monthly churn rate = churned / prev total
  const latestChurnRate = prev && prev.totalUsers > 0
    ? (latest.churnedUsers / prev.totalUsers) * 100
    : 0;
  const prevChurnRate = rows.length >= 3 && rows[rows.length - 3].totalUsers > 0
    ? (prev!.churnedUsers / rows[rows.length - 3].totalUsers) * 100
    : 0;
  const churnRateChange = latestChurnRate - prevChurnRate;

  // NRR = (MRR + expansion - churned) / MRR * 100
  const expansionMrr = parseFloat(latest.expansionMrr as string);
  const churnedMrr = parseFloat(latest.churnedMrr as string);
  const nrr = mrr > 0 ? ((mrr + expansionMrr - churnedMrr) / mrr) * 100 : 100;
  const prevExpansion = parseFloat((prev?.expansionMrr ?? "0") as string);
  const prevChurnedMrr = parseFloat((prev?.churnedMrr ?? "0") as string);
  const prevNrr = prevMrr > 0 ? ((prevMrr + prevExpansion - prevChurnedMrr) / prevMrr) * 100 : 100;
  const nrrChange = nrr - prevNrr;

  const avgRevenuePerUser = totalUsers > 0 ? mrr / totalUsers : 0;
  const prevArpu = prevTotalUsers > 0 ? prevMrr / prevTotalUsers : 0;
  const avgRevenuePerUserChange = prevArpu > 0 ? ((avgRevenuePerUser - prevArpu) / prevArpu) * 100 : 0;

  res.json({
    totalUsers,
    totalUsersChange: Math.round(totalUsersChange * 10) / 10,
    mrr: Math.round(mrr * 100) / 100,
    mrrChange: Math.round(mrrChange * 10) / 10,
    churnRate: Math.round(latestChurnRate * 100) / 100,
    churnRateChange: Math.round(churnRateChange * 100) / 100,
    nrr: Math.round(nrr * 10) / 10,
    nrrChange: Math.round(nrrChange * 10) / 10,
    newUsersThisPeriod,
    churnedUsersThisPeriod,
    avgRevenuePerUser: Math.round(avgRevenuePerUser * 100) / 100,
    avgRevenuePerUserChange: Math.round(avgRevenuePerUserChange * 10) / 10,
  });
});

// GET /api/kpis/user-growth
router.get("/user-growth", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "last_12_months";
  const periodStart = getPeriodStart(period);

  const rows = await db
    .select()
    .from(monthlyMetricsTable)
    .where(gte(monthlyMetricsTable.month, periodStart.toISOString().slice(0, 10)))
    .orderBy(monthlyMetricsTable.month);

  res.json(rows.map(r => ({
    month: (r.month as string).slice(0, 7),
    newUsers: r.newUsers,
    churnedUsers: r.churnedUsers,
    totalUsers: r.totalUsers,
    netNew: r.newUsers - r.churnedUsers,
  })));
});

// GET /api/kpis/churn
router.get("/churn", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "last_12_months";
  const periodStart = getPeriodStart(period);

  const rows = await db
    .select()
    .from(monthlyMetricsTable)
    .where(gte(monthlyMetricsTable.month, periodStart.toISOString().slice(0, 10)))
    .orderBy(monthlyMetricsTable.month);

  const result = rows.map((r, idx) => {
    const prev = idx > 0 ? rows[idx - 1] : null;
    const churnRate = prev && prev.totalUsers > 0
      ? (r.churnedUsers / prev.totalUsers) * 100
      : 0;
    const churnedMrr = parseFloat(r.churnedMrr as string);
    const mrr = parseFloat(r.mrr as string);
    const revenueChurnRate = mrr > 0 ? (churnedMrr / mrr) * 100 : 0;
    return {
      month: (r.month as string).slice(0, 7),
      churnRate: Math.round(churnRate * 100) / 100,
      churnedUsers: r.churnedUsers,
      revenueChurnRate: Math.round(revenueChurnRate * 100) / 100,
      churnedMrr: Math.round(churnedMrr * 100) / 100,
    };
  });

  res.json(result);
});

// GET /api/kpis/retention
router.get("/retention", async (req, res): Promise<void> => {
  const cohortCount = parseInt((req.query.cohort_count as string) || "6", 10);

  const cohorts = await db
    .select({
      cohortMonth: retentionCohortsTable.cohortMonth,
      cohortSize: retentionCohortsTable.cohortSize,
      monthIndex: retentionCohortsTable.monthIndex,
      retentionRate: retentionCohortsTable.retentionRate,
    })
    .from(retentionCohortsTable)
    .orderBy(retentionCohortsTable.cohortMonth, retentionCohortsTable.monthIndex);

  // Group by cohort month
  const grouped: Record<string, { cohortSize: number; retention: (number | null)[] }> = {};
  for (const row of cohorts) {
    const key = (row.cohortMonth as string).slice(0, 7);
    if (!grouped[key]) {
      grouped[key] = { cohortSize: row.cohortSize, retention: [] };
    }
    grouped[key].retention[row.monthIndex] = row.retentionRate
      ? parseFloat(row.retentionRate as string)
      : null;
  }

  const sortedKeys = Object.keys(grouped).sort().slice(-cohortCount);
  res.json(
    sortedKeys.map(k => ({
      cohortMonth: k,
      cohortSize: grouped[k].cohortSize,
      retention: grouped[k].retention,
    }))
  );
});

// GET /api/kpis/revenue
router.get("/revenue", async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "last_12_months";
  const periodStart = getPeriodStart(period);

  const rows = await db
    .select()
    .from(monthlyMetricsTable)
    .where(gte(monthlyMetricsTable.month, periodStart.toISOString().slice(0, 10)))
    .orderBy(monthlyMetricsTable.month);

  res.json(rows.map(r => {
    const mrr = parseFloat(r.mrr as string);
    const newMrr = parseFloat(r.newMrr as string);
    const expansionMrr = parseFloat(r.expansionMrr as string);
    const churnedMrr = parseFloat(r.churnedMrr as string);
    return {
      month: (r.month as string).slice(0, 7),
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      newMrr: Math.round(newMrr * 100) / 100,
      expansionMrr: Math.round(expansionMrr * 100) / 100,
      churnedMrr: Math.round(churnedMrr * 100) / 100,
      netNewMrr: Math.round((newMrr + expansionMrr - churnedMrr) * 100) / 100,
    };
  }));
});

// GET /api/kpis/subscribers
router.get("/subscribers", async (req, res): Promise<void> => {
  const status = (req.query.status as string) || "all";
  const plan = (req.query.plan as string) || "all";
  const search = (req.query.search as string) || "";
  const sortBy = (req.query.sort_by as string) || "mrr";
  const sortDir = (req.query.sort_dir as string) || "desc";
  const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt((req.query.page_size as string) || "25", 10)));

  const conditions = [];

  if (status !== "all") {
    conditions.push(eq(subscribersTable.status, status as "active" | "at_risk" | "churned"));
  }
  if (plan !== "all") {
    conditions.push(eq(subscribersTable.plan, plan as "starter" | "growth" | "enterprise"));
  }
  if (search) {
    conditions.push(
      or(
        ilike(subscribersTable.name, `%${search}%`),
        ilike(subscribersTable.email, `%${search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = {
    name: subscribersTable.name,
    plan: subscribersTable.plan,
    mrr: subscribersTable.mrr,
    tenure: subscribersTable.tenureMonths,
    joined_at: subscribersTable.joinedAt,
  }[sortBy] ?? subscribersTable.mrr;

  const orderBy = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [totalResult, rows] = await Promise.all([
    db.select({ total: count() }).from(subscribersTable).where(where),
    db.select()
      .from(subscribersTable)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  const total = totalResult[0]?.total ?? 0;

  const PLAN_AVG_MRR: Record<string, number> = { starter: 20, growth: 50, enterprise: 160 };

  function computeChurnRisk(r: { status: string; tenureMonths: number; plan: string; mrr: string }): number | null {
    if (r.status === "churned") return null;
    let score = 0;
    // Tenure factor (new users have higher risk)
    if (r.tenureMonths < 1) score += 35;
    else if (r.tenureMonths < 3) score += 25;
    else if (r.tenureMonths < 6) score += 15;
    else if (r.tenureMonths < 12) score += 8;
    // Plan factor
    if (r.plan === "starter") score += 20;
    else if (r.plan === "growth") score += 8;
    // Status factor
    if (r.status === "at_risk") score += 30;
    // MRR factor (below plan average = higher risk)
    const mrr = parseFloat(r.mrr as string);
    const planAvg = PLAN_AVG_MRR[r.plan] ?? 20;
    if (mrr < planAvg * 0.7) score += 10;
    return Math.min(100, Math.max(0, score));
  }

  res.json({
    items: rows.map(r => ({
      id: r.id,
      externalId: r.externalId,
      name: r.name,
      email: r.email,
      plan: r.plan,
      status: r.status,
      mrr: parseFloat(r.mrr as string),
      joinedAt: r.joinedAt,
      churnedAt: r.churnedAt ?? null,
      tenureMonths: r.tenureMonths,
      churnRiskScore: computeChurnRisk(r),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

export default router;
