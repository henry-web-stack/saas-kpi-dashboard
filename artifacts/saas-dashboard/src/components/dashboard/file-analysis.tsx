import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

type ParsedRow = Record<string, string>;

interface ColumnStat {
  name: string;
  type: "numeric" | "categorical" | "date" | "text";
  count: number;
  nullCount: number;
  // numeric
  sum?: number;
  mean?: number;
  min?: number;
  max?: number;
  // categorical
  topValues?: { value: string; count: number }[];
  uniqueCount?: number;
}

const CHART_COLORS = [
  "hsl(211,100%,55%)",
  "hsl(250,100%,74%)",
  "hsl(130,76%,40%)",
  "hsl(0,84%,60%)",
  "hsl(38,92%,50%)",
  "hsl(190,80%,50%)",
];

const DATE_PATTERNS = /date|joined|created|churned|start|end|at$/i;
const NUMERIC_PATTERNS = /mrr|arr|revenue|amount|price|value|count|num|qty|score|rate|pct|percent/i;
const CATEGORICAL_PATTERNS = /status|plan|tier|type|category|segment|country|region|role|source/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function detectColumnType(name: string, values: string[]): ColumnStat["type"] {
  if (DATE_PATTERNS.test(name)) return "date";
  if (NUMERIC_PATTERNS.test(name)) return "numeric";
  if (CATEGORICAL_PATTERNS.test(name)) return "categorical";
  const nonEmpty = values.filter(Boolean);
  if (nonEmpty.length === 0) return "text";
  const numericCount = nonEmpty.filter(v => !isNaN(Number(v.replace(/[$,%]/g, "")))).length;
  if (numericCount / nonEmpty.length > 0.85) return "numeric";
  const uniqueVals = new Set(nonEmpty.map(v => v.toLowerCase()));
  if (uniqueVals.size <= 12 && nonEmpty.length > 10) return "categorical";
  if (nonEmpty.some(v => EMAIL_PATTERN.test(v))) return "text";
  return "text";
}

function analyzeColumn(name: string, values: string[]): ColumnStat {
  const type = detectColumnType(name, values);
  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
  const nullCount = values.length - nonEmpty.length;

  if (type === "numeric") {
    const nums = nonEmpty.map(v => parseFloat(v.replace(/[$,%]/g, ""))).filter(n => !isNaN(n));
    const sum = nums.reduce((a, b) => a + b, 0);
    return {
      name, type, count: nonEmpty.length, nullCount,
      sum: Math.round(sum * 100) / 100,
      mean: nums.length > 0 ? Math.round((sum / nums.length) * 100) / 100 : 0,
      min: nums.length > 0 ? Math.min(...nums) : 0,
      max: nums.length > 0 ? Math.max(...nums) : 0,
    };
  }

  if (type === "categorical") {
    const freq: Record<string, number> = {};
    for (const v of nonEmpty) {
      const key = v.trim();
      freq[key] = (freq[key] ?? 0) + 1;
    }
    const topValues = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({ value, count }));
    return { name, type, count: nonEmpty.length, nullCount, topValues, uniqueCount: Object.keys(freq).length };
  }

  return { name, type, count: nonEmpty.length, nullCount, uniqueCount: new Set(nonEmpty).size };
}

function NumericCard({ stat }: { stat: ColumnStat }) {
  const isCurrency = /mrr|arr|revenue|amount|price/i.test(stat.name);
  const fmt = (n: number | undefined) => {
    if (n === undefined) return "—";
    if (isCurrency) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return n.toLocaleString();
  };
  return (
    <div className="analysis-stat-card">
      <div className="analysis-stat-label">{stat.name}</div>
      <div className="analysis-stat-grid">
        <div><span className="analysis-stat-sub">Total</span><br /><strong>{fmt(stat.sum)}</strong></div>
        <div><span className="analysis-stat-sub">Average</span><br /><strong>{fmt(stat.mean)}</strong></div>
        <div><span className="analysis-stat-sub">Min</span><br /><strong>{fmt(stat.min)}</strong></div>
        <div><span className="analysis-stat-sub">Max</span><br /><strong>{fmt(stat.max)}</strong></div>
      </div>
    </div>
  );
}

function CategoricalCard({ stat }: { stat: ColumnStat }) {
  const top = stat.topValues ?? [];
  const isPie = top.length <= 6;
  return (
    <div className="analysis-stat-card analysis-stat-card--wide">
      <div className="analysis-stat-label">
        {stat.name}
        <span className="analysis-stat-sub" style={{ marginLeft: "0.5rem" }}>
          {stat.uniqueCount} unique values
        </span>
      </div>
      {isPie ? (
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={top} dataKey="count" nameKey="value" cx="50%" cy="50%" outerRadius={60} label={({ value }) => value}>
              {top.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => [v, "count"]} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={top} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="value" width={90} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {top.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function FileAnalysis() {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [stats, setStats] = useState<ColumnStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Only CSV files are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large — max 10 MB.");
      return;
    }
    setLoading(true);
    setError(null);
    setFileName(file.name);

    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data as ParsedRow[];
        const cols = result.meta.fields ?? [];
        setRows(data);
        setColumns(cols);
        const colStats = cols.map(col => {
          const values = data.map(r => r[col] ?? "");
          return analyzeColumn(col, values);
        });
        setStats(colStats);
        setLoading(false);
      },
      error: (err) => {
        setError(`Parse error: ${err.message}`);
        setLoading(false);
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const reset = () => {
    setFileName(null);
    setRows([]);
    setColumns([]);
    setStats([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const numericStats = stats.filter(s => s.type === "numeric");
  const catStats = stats.filter(s => s.type === "categorical");
  const previewRows = rows.slice(0, 8);

  return (
    <div className="chart-card file-analysis-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Import & Analyze</div>
          <div className="chart-subtitle">Upload a CSV file to explore and analyze its data</div>
        </div>
        {fileName && (
          <button className="btn-secondary" onClick={reset}>✕ Clear</button>
        )}
      </div>

      {!fileName && !loading && (
        <div
          className={`upload-drop-zone ${dragging ? "upload-drop-zone--dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="upload-icon">📂</div>
          <div className="upload-title">Drop a CSV file here</div>
          <div className="upload-subtitle">or click to browse · max 10 MB</div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleFileInput}
          />
        </div>
      )}

      {loading && (
        <div className="upload-drop-zone">
          <div className="upload-icon">⏳</div>
          <div className="upload-title">Parsing…</div>
        </div>
      )}

      {error && (
        <div className="upload-error">{error}</div>
      )}

      {fileName && rows.length > 0 && (
        <div className="analysis-results">
          {/* Summary bar */}
          <div className="analysis-summary-bar">
            <div className="analysis-summary-item">
              <span className="analysis-summary-label">File</span>
              <span className="analysis-summary-value">{fileName}</span>
            </div>
            <div className="analysis-summary-item">
              <span className="analysis-summary-label">Rows</span>
              <span className="analysis-summary-value">{rows.length.toLocaleString()}</span>
            </div>
            <div className="analysis-summary-item">
              <span className="analysis-summary-label">Columns</span>
              <span className="analysis-summary-value">{columns.length}</span>
            </div>
            <div className="analysis-summary-item">
              <span className="analysis-summary-label">Numeric</span>
              <span className="analysis-summary-value">{numericStats.length}</span>
            </div>
            <div className="analysis-summary-item">
              <span className="analysis-summary-label">Categorical</span>
              <span className="analysis-summary-value">{catStats.length}</span>
            </div>
          </div>

          {/* Numeric stats */}
          {numericStats.length > 0 && (
            <div className="analysis-section">
              <div className="analysis-section-title">Numeric Columns</div>
              <div className="analysis-cards-grid">
                {numericStats.map(s => <NumericCard key={s.name} stat={s} />)}
              </div>
            </div>
          )}

          {/* Categorical charts */}
          {catStats.length > 0 && (
            <div className="analysis-section">
              <div className="analysis-section-title">Categorical Columns</div>
              <div className="analysis-cards-grid analysis-cards-grid--wide">
                {catStats.map(s => <CategoricalCard key={s.name} stat={s} />)}
              </div>
            </div>
          )}

          {/* Data preview */}
          <div className="analysis-section">
            <div className="analysis-section-title">
              Data Preview <span style={{ fontWeight: 400, opacity: 0.6 }}>(first {previewRows.length} rows)</span>
            </div>
            <div className="analysis-preview-wrap">
              <table className="analysis-preview-table">
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th key={col}>
                        {col}
                        <span className={`col-type-badge col-type-badge--${stats.find(s => s.name === col)?.type ?? "text"}`}>
                          {stats.find(s => s.name === col)?.type ?? ""}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {columns.map(col => (
                        <td key={col} title={row[col]}>{row[col] || <span style={{ opacity: 0.35 }}>—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
