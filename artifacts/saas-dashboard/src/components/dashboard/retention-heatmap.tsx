import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CSVLink } from "react-csv";
import { Download } from "lucide-react";
import type { RetentionCohort } from "@workspace/api-client-react";

interface Props {
  data: RetentionCohort[] | undefined;
  isLoading: boolean;
}

function getColor(value: number | null): string {
  if (value === null) return "hsl(var(--muted))";
  if (value >= 90) return "hsl(211 100% 47%)";
  if (value >= 75) return "hsl(211 100% 55%)";
  if (value >= 60) return "hsl(211 100% 63%)";
  if (value >= 45) return "hsl(211 85% 72%)";
  if (value >= 30) return "hsl(211 60% 80%)";
  if (value >= 15) return "hsl(211 40% 88%)";
  return "hsl(var(--muted))";
}

function getTextColor(value: number | null): string {
  if (value === null) return "hsl(var(--muted-foreground))";
  if (value >= 60) return "hsl(0 0% 100%)";
  return "hsl(var(--foreground))";
}

export function RetentionHeatmap({ data, isLoading }: Props) {
  const maxMonths = useMemo(() => {
    if (!data || data.length === 0) return 6;
    return Math.max(...data.map(c => c.retention.length));
  }, [data]);

  const csvData = useMemo(() => {
    if (!data) return [];
    return data.map(cohort => {
      const row: Record<string, string | number> = { "Cohort Month": cohort.cohortMonth, "Cohort Size": cohort.cohortSize };
      cohort.retention.forEach((r, i) => {
        row[`Month ${i}`] = r !== null ? `${r.toFixed(1)}%` : "-";
      });
      return row;
    });
  }, [data]);

  return (
    <Card className="border border-border rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Retention Cohorts
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">% of users retained by month since acquisition</p>
        </div>
        {data && data.length > 0 && (
          <CSVLink data={csvData} filename="retention-cohorts.csv" className="print:hidden">
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-muted">
              <Download className="w-3 h-3" />
              CSV
            </button>
          </CSVLink>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No cohort data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground whitespace-nowrap">Cohort</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Size</th>
                  {Array.from({ length: maxMonths }, (_, i) => (
                    <th key={i} className="text-center py-2 px-1 font-medium text-muted-foreground min-w-[42px]">
                      M{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((cohort) => (
                  <tr key={cohort.cohortMonth} className="border-t border-border/40">
                    <td className="py-1 pr-3 font-medium text-foreground whitespace-nowrap">{cohort.cohortMonth}</td>
                    <td className="py-1 px-2 text-right text-muted-foreground">{cohort.cohortSize.toLocaleString()}</td>
                    {Array.from({ length: maxMonths }, (_, i) => {
                      const val = cohort.retention[i] ?? null;
                      return (
                        <td key={i} className="py-1 px-0.5">
                          <div
                            className="rounded text-center py-1.5 px-1 min-w-[38px] font-medium tabular-nums transition-colors"
                            style={{
                              backgroundColor: getColor(val),
                              color: getTextColor(val),
                            }}
                          >
                            {val !== null ? `${val.toFixed(0)}%` : "–"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
