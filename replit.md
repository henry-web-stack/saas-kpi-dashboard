# SaaS KPI Dashboard

A SaaS metrics dashboard showing user growth, churn rate, revenue (MRR/ARR), and cohort retention trends over time.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from workflow)
- `pnpm --filter @workspace/saas-dashboard run dev` — run the frontend (port from workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite, Recharts, shadcn/ui, TanStack React Query
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/kpi-metrics.ts` — DB schema (monthly_metrics, retention_cohorts tables)
- `artifacts/api-server/src/routes/kpis.ts` — all KPI API route handlers
- `artifacts/saas-dashboard/src/pages/dashboard.tsx` — main dashboard page
- `artifacts/saas-dashboard/src/components/dashboard/` — KPI cards, charts, controls

## Architecture decisions

- Contract-first: OpenAPI spec drives both React Query hooks (frontend) and Zod validation (backend)
- All metrics computed from two DB tables: `monthly_metrics` (24 months) and `retention_cohorts` (6 cohorts)
- Period selector drives all chart queries; KPI summary maps chart periods to summary periods
- No auto-refresh by default; 5-minute floor on auto-refresh to avoid cost overruns

## Product

Users can monitor their SaaS business health via:
- KPI cards: Total Users, MRR, Churn Rate, NRR, New Users, Churned Users, ARPU
- User Growth chart (bars + total users line)
- MRR Growth area chart with new/expansion/churned MRR breakdown
- Churn Rate line chart (user + revenue churn)
- Retention Cohort heatmap (month-by-month retention %)
- Period selector, manual refresh, auto-refresh, PDF export, dark mode, CSV export per chart

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` after changing any `lib/*` package, before checking artifact typechecks
- CSS: do NOT use Tailwind shadow utility classes (shadow-sm, etc.) — shadows are zeroed intentionally
- Font: IBM Plex Sans (configured in index.css)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
