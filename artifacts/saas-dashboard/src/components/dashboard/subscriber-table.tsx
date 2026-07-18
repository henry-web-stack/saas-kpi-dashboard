import { useState, useCallback } from "react";
import {
  useGetSubscribers,
  getGetSubscribersQueryKey,
  type SubscriberRecord,
} from "@workspace/api-client-react";

type Status = "all" | "active" | "at_risk" | "churned";
type Plan = "all" | "starter" | "growth" | "enterprise";
type SortBy = "name" | "plan" | "mrr" | "tenure" | "joined_at";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active:   { label: "Active",   className: "status-active" },
  at_risk:  { label: "At Risk",  className: "status-at-risk" },
  churned:  { label: "Churned",  className: "status-churned" },
};

const PLAN_LABELS: Record<string, string> = {
  starter:    "Starter",
  growth:     "Growth",
  enterprise: "Enterprise",
};

function SortIcon({ col, sortBy, sortDir }: { col: SortBy; sortBy: SortBy; sortDir: SortDir }) {
  if (sortBy !== col) return <span className="sort-icon sort-icon--inactive">↕</span>;
  return <span className="sort-icon sort-icon--active">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function formatTenure(months: number): string {
  if (months === 0) return "< 1 mo";
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}y ${m}mo` : `${y}y`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function RiskScore({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="risk-score risk-score--na">—</span>;
  }
  let level: string;
  if (score >= 76) level = "critical";
  else if (score >= 56) level = "high";
  else if (score >= 26) level = "medium";
  else level = "low";
  return (
    <span className={`risk-score risk-score--${level}`} title={`Risk score: ${score}/100`}>
      {score}
    </span>
  );
}

function exportCsv(items: SubscriberRecord[]) {
  const header = ["Name", "Email", "Plan", "Status", "MRR ($)", "Risk Score", "Tenure", "Joined", "Churned"];
  const rows = items.map(r => [
    `"${r.name}"`,
    `"${r.email}"`,
    r.plan,
    r.status,
    r.mrr.toFixed(2),
    r.churnRiskScore ?? "",
    formatTenure(r.tenureMonths),
    r.joinedAt,
    r.churnedAt ?? "",
  ]);
  const csv = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "subscribers.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function SubscriberTable() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [plan, setPlan] = useState<Plan>("all");
  const [sortBy, setSortBy] = useState<SortBy>("mrr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const params = {
    status,
    plan,
    search: debouncedSearch || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
    page,
    page_size: 25,
  };

  const { data, isLoading, isFetching } = useGetSubscribers(params, {
    query: { queryKey: getGetSubscribersQueryKey(params) },
  });

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((handleSearchChange as { timer?: ReturnType<typeof setTimeout> }).timer);
    const timer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
    (handleSearchChange as { timer?: ReturnType<typeof setTimeout> }).timer = timer;
  }, []);

  function handleSort(col: SortBy) {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir(col === "name" || col === "joined_at" ? "asc" : "desc");
    }
    setPage(1);
  }

  function handleStatusChange(s: Status) { setStatus(s); setPage(1); }
  function handlePlanChange(p: Plan) { setPlan(p); setPage(1); }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const loading = isLoading || isFetching;

  return (
    <div className="chart-card subscriber-table-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Subscriber Drilldown</div>
          <div className="chart-subtitle">
            {loading ? "Loading…" : `${total.toLocaleString()} subscribers`}
          </div>
        </div>
        <button
          className="btn-secondary"
          onClick={() => items.length > 0 && exportCsv(items)}
          disabled={items.length === 0}
        >
          ↓ CSV
        </button>
      </div>

      {/* Filters */}
      <div className="subscriber-filters">
        <input
          className="subscriber-search"
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
        />
        <div className="filter-group">
          <label className="filter-label">Status</label>
          <div className="filter-pills">
            {(["all", "active", "at_risk", "churned"] as Status[]).map(s => (
              <button
                key={s}
                className={`filter-pill ${status === s ? "filter-pill--active" : ""}`}
                onClick={() => handleStatusChange(s)}
              >
                {s === "all" ? "All" : STATUS_LABELS[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label">Plan</label>
          <div className="filter-pills">
            {(["all", "starter", "growth", "enterprise"] as Plan[]).map(p => (
              <button
                key={p}
                className={`filter-pill ${plan === p ? "filter-pill--active" : ""}`}
                onClick={() => handlePlanChange(p)}
              >
                {p === "all" ? "All" : PLAN_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Risk score legend */}
      <div className="risk-legend">
        <span className="risk-legend-label">Churn Risk:</span>
        <span className="risk-score risk-score--low">0–25 Low</span>
        <span className="risk-score risk-score--medium">26–55 Medium</span>
        <span className="risk-score risk-score--high">56–75 High</span>
        <span className="risk-score risk-score--critical">76–100 Critical</span>
      </div>

      {/* Table */}
      <div className="subscriber-table-wrap">
        <table className="subscriber-table">
          <thead>
            <tr>
              <th className="th-sortable" onClick={() => handleSort("name")}>
                Name <SortIcon col="name" sortBy={sortBy} sortDir={sortDir} />
              </th>
              <th>Email</th>
              <th className="th-sortable" onClick={() => handleSort("plan")}>
                Plan <SortIcon col="plan" sortBy={sortBy} sortDir={sortDir} />
              </th>
              <th>Status</th>
              <th className="th-sortable th-right" onClick={() => handleSort("mrr")}>
                MRR <SortIcon col="mrr" sortBy={sortBy} sortDir={sortDir} />
              </th>
              <th className="th-right">Risk</th>
              <th className="th-sortable th-right" onClick={() => handleSort("tenure")}>
                Tenure <SortIcon col="tenure" sortBy={sortBy} sortDir={sortDir} />
              </th>
              <th className="th-sortable" onClick={() => handleSort("joined_at")}>
                Joined <SortIcon col="joined_at" sortBy={sortBy} sortDir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr><td colSpan={8} className="td-empty">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="td-empty">No subscribers found</td></tr>
            ) : items.map(row => {
              const statusInfo = STATUS_LABELS[row.status] ?? { label: row.status, className: "" };
              return (
                <tr key={row.id} className={loading ? "tr-loading" : ""}>
                  <td className="td-name">{row.name}</td>
                  <td className="td-email">{row.email}</td>
                  <td>
                    <span className={`plan-badge plan-badge--${row.plan}`}>
                      {PLAN_LABELS[row.plan] ?? row.plan}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="td-right td-mrr">${row.mrr.toFixed(2)}</td>
                  <td className="td-right">
                    <RiskScore score={row.churnRiskScore} />
                  </td>
                  <td className="td-right">{formatTenure(row.tenureMonths)}</td>
                  <td>{formatDate(row.joinedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="subscriber-pagination">
          <button
            className="pagination-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            ← Prev
          </button>
          <span className="pagination-info">
            Page {page} of {totalPages}
            <span className="pagination-total"> ({total.toLocaleString()} total)</span>
          </span>
          <button
            className="pagination-btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
