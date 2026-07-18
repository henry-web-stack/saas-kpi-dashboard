import { useState, useEffect, useCallback, useRef } from "react";
import {
  useGetKpiSummary,
  getGetKpiSummaryQueryKey,
  useGetUserGrowth,
  getGetUserGrowthQueryKey,
  useGetChurnMetrics,
  getGetChurnMetricsQueryKey,
  useGetRetentionCohorts,
  getGetRetentionCohortsQueryKey,
  useGetRevenueMetrics,
  getGetRevenueMetricsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DashboardControls, CHART_PERIOD_OPTIONS } from "@/components/dashboard/controls";
import { UserGrowthChart } from "@/components/dashboard/user-growth-chart";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ChurnChart } from "@/components/dashboard/churn-chart";
import { RetentionHeatmap } from "@/components/dashboard/retention-heatmap";
import { SubscriberTable } from "@/components/dashboard/subscriber-table";
import { FileAnalysis } from "@/components/dashboard/file-analysis";

type ChartPeriod = "last_6_months" | "last_12_months" | "last_24_months";

export default function Dashboard() {
  const [period, setPeriod] = useState<ChartPeriod>("last_12_months");
  const [autoRefreshMs, setAutoRefreshMs] = useState<number | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const summaryPeriod = period === "last_6_months" ? "last_6_months"
    : period === "last_24_months" ? "last_12_months"
    : "last_12_months";

  const kpiParams = { period: summaryPeriod as "last_6_months" | "last_12_months" | "all_time" };
  const chartParams = { period };

  const { data: summary, isLoading: summaryLoading, isFetching: summaryFetching } = useGetKpiSummary(kpiParams, {
    query: { queryKey: getGetKpiSummaryQueryKey(kpiParams) }
  });
  const { data: userGrowth, isLoading: growthLoading, isFetching: growthFetching } = useGetUserGrowth(chartParams, {
    query: { queryKey: getGetUserGrowthQueryKey(chartParams) }
  });
  const { data: churnData, isLoading: churnLoading, isFetching: churnFetching } = useGetChurnMetrics(chartParams, {
    query: { queryKey: getGetChurnMetricsQueryKey(chartParams) }
  });
  const { data: retentionData, isLoading: retentionLoading, isFetching: retentionFetching } = useGetRetentionCohorts({ cohort_count: 6 }, {
    query: { queryKey: getGetRetentionCohortsQueryKey({ cohort_count: 6 }) }
  });
  const { data: revenueData, isLoading: revenueLoading, isFetching: revenueFetching } = useGetRevenueMetrics(chartParams, {
    query: { queryKey: getGetRevenueMetricsQueryKey(chartParams) }
  });

  const isAnyLoading = summaryLoading || summaryFetching || growthLoading || growthFetching
    || churnLoading || churnFetching || revenueLoading || revenueFetching
    || retentionLoading || retentionFetching;

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetKpiSummaryQueryKey(kpiParams) });
    queryClient.invalidateQueries({ queryKey: getGetUserGrowthQueryKey(chartParams) });
    queryClient.invalidateQueries({ queryKey: getGetChurnMetricsQueryKey(chartParams) });
    queryClient.invalidateQueries({ queryKey: getGetRetentionCohortsQueryKey({ cohort_count: 6 }) });
    queryClient.invalidateQueries({ queryKey: getGetRevenueMetricsQueryKey(chartParams) });
    setLastRefreshed(new Date().toLocaleTimeString());
  }, [queryClient, period]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefreshMs !== null) {
      intervalRef.current = setInterval(refreshAll, autoRefreshMs);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefreshMs, refreshAll]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1400px] mx-auto px-6 pt-8 pb-16">
        <DashboardControls
          loading={isAnyLoading}
          lastRefreshed={lastRefreshed}
          onRefresh={refreshAll}
          autoRefreshMs={autoRefreshMs}
          onAutoRefreshChange={setAutoRefreshMs}
          period={period}
          onPeriodChange={(p) => setPeriod(p as ChartPeriod)}
        />

        {/* Primary KPI cards */}
        <div className="border border-border rounded-lg overflow-hidden mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <KPICard
              title="Total Users"
              value={summary?.totalUsers ?? 0}
              change={summary?.totalUsersChange ?? 0}
              loading={summaryLoading || summaryFetching}
              isPositiveGood={true}
            />
            <KPICard
              title="MRR"
              value={summary ? `$${(summary.mrr / 1000).toFixed(1)}k` : "$0"}
              change={summary?.mrrChange ?? 0}
              loading={summaryLoading || summaryFetching}
              isPositiveGood={true}
            />
            <KPICard
              title="Churn Rate"
              value={summary ? `${summary.churnRate.toFixed(2)}%` : "0%"}
              change={summary?.churnRateChange ?? 0}
              loading={summaryLoading || summaryFetching}
              isPositiveGood={false}
            />
            <KPICard
              title="NRR"
              value={summary ? `${summary.nrr.toFixed(1)}%` : "0%"}
              change={summary?.nrrChange ?? 0}
              loading={summaryLoading || summaryFetching}
              isPositiveGood={true}
            />
          </div>
        </div>

        {/* Secondary KPI cards */}
        <div className="border border-border rounded-lg overflow-hidden mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3">
            <KPICard
              title="New Users"
              value={summary?.newUsersThisPeriod ?? 0}
              change={summary?.totalUsersChange ?? 0}
              loading={summaryLoading || summaryFetching}
              isPositiveGood={true}
            />
            <KPICard
              title="Churned Users"
              value={summary?.churnedUsersThisPeriod ?? 0}
              change={summary?.churnRateChange ?? 0}
              loading={summaryLoading || summaryFetching}
              isPositiveGood={false}
            />
            <KPICard
              title="ARPU"
              value={summary ? `$${summary.avgRevenuePerUser.toFixed(2)}` : "$0"}
              change={summary?.avgRevenuePerUserChange ?? 0}
              loading={summaryLoading || summaryFetching}
              isPositiveGood={true}
            />
          </div>
        </div>

        {/* Charts - 2 column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UserGrowthChart
            data={userGrowth}
            isLoading={growthLoading || growthFetching}
          />
          <RevenueChart
            data={revenueData}
            isLoading={revenueLoading || revenueFetching}
          />
        </div>

        {/* Churn chart full width */}
        <div className="mb-6">
          <ChurnChart
            data={churnData}
            isLoading={churnLoading || churnFetching}
          />
        </div>

        {/* Retention heatmap full width */}
        <RetentionHeatmap
          data={retentionData}
          isLoading={retentionLoading || retentionFetching}
        />

        {/* Subscriber drilldown table */}
        <SubscriberTable />

        {/* File upload & analysis */}
        <FileAnalysis />
      </div>
    </div>
  );
}
