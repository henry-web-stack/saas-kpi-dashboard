import { db, subscribersTable } from "@workspace/db";
import { randomUUID } from "crypto";

const FIRST_NAMES = [
  "Alex", "Jordan", "Morgan", "Taylor", "Casey", "Riley", "Drew", "Avery",
  "Cameron", "Quinn", "Peyton", "Sage", "River", "Blake", "Finley", "Dakota",
  "Rowan", "Emerson", "Skylar", "Reese", "Harley", "Logan", "Charlie", "Jamie",
  "Sam", "Bailey", "Kendall", "Hayden", "Parker", "Jesse", "Addison", "Spencer",
  "Sydney", "Hunter", "Brooke", "Mackenzie", "Devon", "Shannon", "Tatum", "Marley",
  "Remy", "Noel", "Elliot", "Phoenix", "Sutton", "Lennon", "Sloane", "Paige",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson",
  "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson",
  "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee", "Walker",
  "Hall", "Allen", "Young", "Hernandez", "King", "Wright", "Lopez", "Hill",
  "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter", "Mitchell",
  "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards",
];

const DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me",
  "icloud.com", "me.com", "fastmail.com", "hey.com", "zoho.com",
  "company.io", "startup.co", "corp.com", "biz.net", "ventures.com",
];

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const TODAY = new Date(2026, 5, 16); // June 16, 2026
const START = new Date(2024, 5, 1);  // June 2024 — 24 months back

const PLAN_MRR: Record<string, [number, number]> = {
  starter:    [15, 25],
  growth:     [35, 65],
  enterprise: [120, 200],
};

const PLAN_WEIGHTS = [
  { plan: "starter",    weight: 0.58 },
  { plan: "growth",     weight: 0.31 },
  { plan: "enterprise", weight: 0.11 },
];

function pickPlan(): string {
  const r = Math.random();
  let cumulative = 0;
  for (const { plan, weight } of PLAN_WEIGHTS) {
    cumulative += weight;
    if (r < cumulative) return plan;
  }
  return "starter";
}

async function main() {
  console.log("Seeding subscribers...");

  await db.delete(subscribersTable);

  const usedEmails = new Set<string>();
  const records: (typeof subscribersTable.$inferInsert)[] = [];

  // Generate ~1400 subscribers distributed across 24 months
  // Monthly new-user counts from the monthly_metrics seed:
  // roughly 30-50 per month, growing to 60-80 in later months
  const monthlyNewCounts: number[] = [];
  for (let m = 0; m < 24; m++) {
    // Growth curve: starts ~30, ramps to ~70 over 24 months
    const base = 30 + m * 1.5 + (Math.random() * 10 - 5);
    monthlyNewCounts.push(Math.round(base));
  }

  for (let m = 0; m < 24; m++) {
    const cohortMonth = addMonths(START, m);
    const count = monthlyNewCounts[m];
    const tenureAtToday = 23 - m; // months since joined

    for (let i = 0; i < count; i++) {
      const firstName = randItem(FIRST_NAMES);
      const lastName = randItem(LAST_NAMES);
      const plan = pickPlan();
      const [mrrMin, mrrMax] = PLAN_MRR[plan];
      const mrr = Math.round(randBetween(mrrMin, mrrMax) * 100) / 100;

      // Stagger join day within the month
      const joinDay = Math.floor(Math.random() * 28) + 1;
      const joinedAt = new Date(cohortMonth.getFullYear(), cohortMonth.getMonth(), joinDay);

      // Determine status:
      // - Subscribers from recent 3 months: 20% at_risk (new, not yet proven)
      // - Older subscribers: 5% at_risk
      // - Churn probability rises with age, higher for starter plan
      const isRecent = tenureAtToday <= 3;
      let churnProb = isRecent ? 0.05 : (tenureAtToday > 12 ? 0.18 : 0.12);
      if (plan === "starter") churnProb *= 1.3;
      if (plan === "enterprise") churnProb *= 0.4;

      let status: "active" | "at_risk" | "churned";
      let churnedAt: string | null = null;
      let tenureMonths: number;

      const r = Math.random();
      if (r < churnProb) {
        status = "churned";
        // Churned sometime during their tenure
        const churnMonthOffset = Math.floor(Math.random() * Math.max(1, tenureAtToday - 1)) + 1;
        const churnDate = addMonths(joinedAt, churnMonthOffset);
        churnedAt = toDateStr(churnDate > TODAY ? TODAY : churnDate);
        tenureMonths = churnMonthOffset;
      } else {
        const atRiskProb = isRecent ? 0.18 : 0.07;
        status = r < churnProb + atRiskProb ? "at_risk" : "active";
        tenureMonths = tenureAtToday;
        churnedAt = null;
      }

      // Generate unique email
      let email: string;
      let attempts = 0;
      do {
        const suffix = attempts > 0 ? `${Math.floor(Math.random() * 999)}` : "";
        email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@${randItem(DOMAINS)}`;
        attempts++;
      } while (usedEmails.has(email) && attempts < 10);
      usedEmails.add(email);

      records.push({
        externalId: randomUUID(),
        name: `${firstName} ${lastName}`,
        email,
        plan: plan as "starter" | "growth" | "enterprise",
        status,
        mrr: mrr.toString(),
        joinedAt: toDateStr(joinedAt),
        churnedAt,
        tenureMonths,
      });
    }
  }

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    await db.insert(subscribersTable).values(records.slice(i, i + batchSize));
  }

  const total = records.length;
  const active = records.filter(r => r.status === "active").length;
  const atRisk = records.filter(r => r.status === "at_risk").length;
  const churned = records.filter(r => r.status === "churned").length;

  console.log(`✅ Seeded ${total} subscribers: ${active} active, ${atRisk} at-risk, ${churned} churned`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
