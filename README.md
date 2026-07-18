# SaaS KPI Dashboard

A full-stack SaaS metrics dashboard showing user growth, churn rate, revenue (MRR/ARR), cohort retention, and subscriber drilldown — built with React, Express, PostgreSQL, and Recharts. Includes a Python/Streamlit version.

## Live Features

- **KPI Cards** — Total Users, MRR, Churn Rate, NRR, New Users, Churned Users, ARPU with period-over-period change indicators
- **User Growth Chart** — bars for new/churned + total users line
- **MRR Growth Chart** — area chart with new/expansion/churned MRR breakdown
- **Churn Rate Chart** — user churn + revenue churn with average reference line
- **Retention Cohort Heatmap** — month-by-month retention % per acquisition cohort
- **Subscriber Drilldown Table** — searchable, filterable, sortable with churn risk scores (0–100)
- **Import & Analyze** — drag-and-drop CSV upload with auto-detected column types, summary stats, and charts
- **Controls** — period selector (6/12/24 months), manual refresh, auto-refresh, PDF export, dark mode, CSV export per chart

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Recharts, shadcn/ui, TanStack React Query |
| Backend | Express 5, Node.js 24, TypeScript 5.9 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| API Contract | OpenAPI 3.1 → Orval codegen (React Query hooks + Zod schemas) |
| Package Manager | pnpm workspaces |
| Python Version | Streamlit + Plotly + psycopg2 |

## Project Structure

```
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   └── saas-dashboard/      # React + Vite frontend
├── lib/
│   ├── api-spec/            # OpenAPI spec (source of truth)
│   ├── api-client-react/    # Generated React Query hooks
│   ├── db/                  # Drizzle ORM schema + migrations
│   └── zod-schemas/         # Generated Zod validation schemas
├── scripts/
│   └── src/seed-subscribers.ts  # DB seed script
├── dashboard.py             # Python/Streamlit version
└── requirements-dashboard.txt
```

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL database

### Setup

```bash
# Install dependencies
pnpm install

# Set environment variable
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Push database schema
pnpm --filter @workspace/db run push

# Seed sample data
pnpm --filter @workspace/scripts run seed-subscribers

# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend (in a new terminal)
pnpm --filter @workspace/saas-dashboard run dev
```

### Python Version

```bash
pip install -r requirements-dashboard.txt
DATABASE_URL="postgresql://user:pass@host:5432/dbname" streamlit run dashboard.py
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kpis/summary` | KPI summary cards |
| GET | `/api/kpis/user-growth` | Monthly user growth data |
| GET | `/api/kpis/revenue` | Monthly MRR/ARR breakdown |
| GET | `/api/kpis/churn` | Monthly churn metrics |
| GET | `/api/kpis/retention` | Cohort retention rates |
| GET | `/api/kpis/subscribers` | Paginated subscriber list with churn risk scores |

## Database Schema

- `monthly_metrics` — 24 months of aggregated SaaS metrics
- `retention_cohorts` — cohort retention rates by month index
- `subscribers` — individual subscriber records with plan, status, MRR, tenure

## Churn Risk Score

Computed server-side per subscriber (0–100):

| Factor | Points |
|--------|--------|
| Tenure < 1 month | +35 |
| Tenure 1–3 months | +25 |
| Tenure 3–6 months | +15 |
| Tenure 6–12 months | +8 |
| Starter plan | +20 |
| Growth plan | +8 |
| Status = at_risk | +30 |
| MRR < 70% of plan average | +10 |

🟢 0–25 Low · 🟡 26–55 Medium · 🟠 56–75 High · 🔴 76–100 Critical
