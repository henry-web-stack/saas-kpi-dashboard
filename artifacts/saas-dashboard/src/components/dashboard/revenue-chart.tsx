import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CSVLink } from "react-csv";
import { Download } from "lucide-react";
import type { RevenuePoint } from "@workspace/api-client-react";

const CHART_COLORS = {
  mrr: "hsl(211 100% 47%)",
  newMrr: "hsl(130 100% 28%)",
  expansionMrr: "hsl(250 100% 68%)",
  churnedMrr: "hsl(0 91% 34%)",
};

interface Props {
  data: RevenuePoint[] | undefined;
  isLoading: boolean;
}

function formatMrr(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function RevenueChart({ data, isLoading }: Props) {
  const csvData = useMemo(() =>
    (data ?? []).map(d => ({
      Month: d.month,
      MRR: d.mrr,
      ARR: d.arr,
      "New MRR": d.newMrr,
      "Expansion MRR": d.expansionMrr,
      "Churned MRR": d.churnedMrr,
      "Net New MRR": d.netNewMrr,
    })), [data]);

  return (
    <Card className="border border-border rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
          MRR Growth
        </CardTitle>
        {data && data.length > 0 && (
          <CSVLink data={csvData} filename="revenue.csv" className="print:hidden">
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-muted">
              <Download className="w-3 h-3" />
              CSV
            </button>
          </CSVLink>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.mrr} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={CHART_COLORS.mrr} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatMrr}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: 12,
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { mrr: "MRR", newMrr: "New MRR", expansionMrr: "Expansion", churnedMrr: "Churned MRR" };
                  return [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, labels[name] ?? name];
                }}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => {
                  const labels: Record<string, string> = { mrr: "MRR", newMrr: "New MRR", expansionMrr: "Expansion", churnedMrr: "Churned" };
                  return labels[value] ?? value;
                }}
              />
              <Area
                type="monotone"
                dataKey="mrr"
                stroke={CHART_COLORS.mrr}
                strokeWidth={2}
                fill="url(#mrrGrad)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="newMrr"
                stroke={CHART_COLORS.newMrr}
                strokeWidth={1.5}
                fill="none"
                dot={false}
                strokeDasharray="4 2"
              />
              <Area
                type="monotone"
                dataKey="expansionMrr"
                stroke={CHART_COLORS.expansionMrr}
                strokeWidth={1.5}
                fill="none"
                dot={false}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
