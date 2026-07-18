import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CSVLink } from "react-csv";
import { Download } from "lucide-react";
import type { ChurnPoint } from "@workspace/api-client-react";

interface Props {
  data: ChurnPoint[] | undefined;
  isLoading: boolean;
}

export function ChurnChart({ data, isLoading }: Props) {
  const csvData = useMemo(() =>
    (data ?? []).map(d => ({
      Month: d.month,
      "Churn Rate (%)": d.churnRate,
      "Churned Users": d.churnedUsers,
      "Revenue Churn (%)": d.revenueChurnRate,
      "Churned MRR": d.churnedMrr,
    })), [data]);

  // Average churn rate for reference line
  const avgChurn = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const nonZero = data.filter(d => d.churnRate > 0);
    if (nonZero.length === 0) return 0;
    return nonZero.reduce((s, d) => s + d.churnRate, 0) / nonZero.length;
  }, [data]);

  return (
    <Card className="border border-border rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Churn Rate
        </CardTitle>
        {data && data.length > 0 && (
          <CSVLink data={csvData} filename="churn-metrics.csv" className="print:hidden">
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
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                tickFormatter={(v) => `${v.toFixed(1)}%`}
              />
              {avgChurn > 0 && (
                <ReferenceLine
                  y={avgChurn}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                  label={{ value: `avg ${avgChurn.toFixed(1)}%`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
              )}
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: 12,
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "churnRate") return [`${value.toFixed(2)}%`, "User Churn"];
                  if (name === "revenueChurnRate") return [`${value.toFixed(2)}%`, "Revenue Churn"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => {
                  if (value === "churnRate") return "User Churn Rate";
                  if (value === "revenueChurnRate") return "Revenue Churn Rate";
                  return value;
                }}
              />
              <Line
                type="monotone"
                dataKey="churnRate"
                stroke="hsl(0 91% 34%)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="revenueChurnRate"
                stroke="hsl(330 81% 60%)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
