import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CSVLink } from "react-csv";
import { Download } from "lucide-react";
import type { UserGrowthPoint } from "@workspace/api-client-react";

const CHART_COLORS = {
  newUsers: "hsl(211 100% 47%)",
  churnedUsers: "hsl(0 91% 34%)",
  totalUsers: "hsl(250 100% 68%)",
};

interface Props {
  data: UserGrowthPoint[] | undefined;
  isLoading: boolean;
}

export function UserGrowthChart({ data, isLoading }: Props) {
  const chartData = useMemo(() =>
    (data ?? []).map(d => ({
      ...d,
      churnedUsers: -d.churnedUsers,
    })), [data]);

  const csvData = useMemo(() =>
    (data ?? []).map(d => ({
      Month: d.month,
      "New Users": d.newUsers,
      "Churned Users": d.churnedUsers,
      "Total Users": d.totalUsers,
      "Net New": d.netNew,
    })), [data]);

  return (
    <Card className="border border-border rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
          User Growth
        </CardTitle>
        {data && data.length > 0 && (
          <CSVLink data={csvData} filename="user-growth.csv" className="print:hidden">
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
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v.slice(0, 7)}
              />
              <YAxis
                yAxisId="bar"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => Math.abs(v).toLocaleString()}
              />
              <YAxis
                yAxisId="line"
                orientation="right"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v.toLocaleString()}
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
                  if (name === "churnedUsers") return [Math.abs(value).toLocaleString(), "Churned"];
                  if (name === "newUsers") return [value.toLocaleString(), "New Users"];
                  if (name === "totalUsers") return [value.toLocaleString(), "Total Users"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => {
                  if (value === "newUsers") return "New Users";
                  if (value === "churnedUsers") return "Churned";
                  if (value === "totalUsers") return "Total Users";
                  return value;
                }}
              />
              <Bar yAxisId="bar" dataKey="newUsers" fill={CHART_COLORS.newUsers} radius={[2, 2, 0, 0]} maxBarSize={24} />
              <Bar yAxisId="bar" dataKey="churnedUsers" fill={CHART_COLORS.churnedUsers} radius={[0, 0, 2, 2]} maxBarSize={24} />
              <Line
                yAxisId="line"
                type="monotone"
                dataKey="totalUsers"
                stroke={CHART_COLORS.totalUsers}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
