import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  change: number;
  loading: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
  isPositiveGood?: boolean;
}

export function KPICard({ 
  title, 
  value, 
  change, 
  loading, 
  valuePrefix = "", 
  valueSuffix = "",
  isPositiveGood = true
}: KPICardProps) {
  const isPositive = change >= 0;
  const isGood = isPositive === isPositiveGood;
  
  const colorClass = isGood ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500";
  const iconColorClass = isGood ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500";
  
  return (
    <Card className="rounded-none border-t-0 border-l-0 border-r-0 border-b border-border sm:border-b-0 sm:border-r last:border-r-0">
      <CardContent className="p-6">
        {loading ? (
          <>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold mt-1 tracking-tight text-foreground">
              {valuePrefix}{typeof value === "number" ? value.toLocaleString() : value}{valueSuffix}
            </p>
            <div className="flex items-center gap-1 mt-2 font-medium">
              {isPositive ? 
                <ArrowUpIcon className={`w-4 h-4 ${iconColorClass}`} /> : 
                <ArrowDownIcon className={`w-4 h-4 ${iconColorClass}`} />
              }
              <span className={`text-sm ${colorClass}`}>
                {Math.abs(change).toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground ml-1">vs last period</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
