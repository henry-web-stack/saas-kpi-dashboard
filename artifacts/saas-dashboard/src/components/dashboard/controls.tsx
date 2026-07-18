import { useState, useEffect, useRef } from "react";
import { RefreshCw, ChevronDown, Check, Sun, Moon, Printer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const INTERVAL_OPTIONS = [
  { label: "Every 5 min", ms: 5 * 60 * 1000 },
  { label: "Every 15 min", ms: 15 * 60 * 1000 },
  { label: "Every 1 hour", ms: 60 * 60 * 1000 },
  { label: "Every 24 hours", ms: 24 * 60 * 60 * 1000 },
];

export const PERIOD_OPTIONS = [
  { label: "Last 30 Days", value: "last_30_days" },
  { label: "Last 90 Days", value: "last_90_days" },
  { label: "Last 6 Months", value: "last_6_months" },
  { label: "Last 12 Months", value: "last_12_months" },
  { label: "All Time", value: "all_time" },
];

export const CHART_PERIOD_OPTIONS = [
  { label: "Last 6 Months", value: "last_6_months" },
  { label: "Last 12 Months", value: "last_12_months" },
  { label: "Last 24 Months", value: "last_24_months" },
];

interface ControlsProps {
  loading: boolean;
  lastRefreshed: string | null;
  onRefresh: () => void;
  autoRefreshMs: number | null;
  onAutoRefreshChange: (ms: number | null) => void;
  period: string;
  onPeriodChange: (p: string) => void;
}

const DATA_SOURCES = ["App DB", "Stripe Billing"];

export function DashboardControls({
  loading,
  lastRefreshed,
  onRefresh,
  autoRefreshMs,
  onAutoRefreshChange,
  period,
  onPeriodChange,
}: ControlsProps) {
  const [isDark, setIsDark] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (loading) {
      setIsSpinning(true);
      return;
    }
    const t = setTimeout(() => setIsSpinning(false), 600);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
        <div className="pt-2">
          <h1 className="font-bold tracking-tight text-[32px] text-foreground">Overview</h1>
          
          {DATA_SOURCES.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-[12px] text-muted-foreground shrink-0 uppercase tracking-wider font-medium">
                Sources
              </span>
              {DATA_SOURCES.map((source) => (
                <span
                  key={source}
                  className="text-[11px] font-medium rounded px-1.5 py-0.5 truncate print:!bg-[rgb(229,231,235)] print:!text-[rgb(75,85,99)] border border-border bg-muted text-muted-foreground"
                  title={source}
                  style={{ maxWidth: "20ch" }}
                >
                  {source}
                </span>
              ))}
            </div>
          )}
          
          {lastRefreshed && <p className="text-[12px] text-muted-foreground mt-2">Updated {lastRefreshed}</p>}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 pt-2 print:hidden">
          <div className="w-[180px]">
            <Select value={period} onValueChange={onPeriodChange}>
              <SelectTrigger className="h-[32px] text-[13px] bg-background">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {CHART_PERIOD_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-[13px]">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative" ref={dropdownRef}>
            <div
              className="flex items-center rounded-md overflow-hidden h-[32px] text-[13px] border border-border bg-background"
            >
              <button 
                onClick={onRefresh} 
                disabled={loading} 
                className="flex items-center font-medium gap-1.5 px-3 h-full hover:bg-muted transition-colors disabled:opacity-50 text-foreground"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <div className="w-px h-5 shrink-0 bg-border" />
              <button 
                onClick={() => setDropdownOpen((o) => !o)} 
                className="flex items-center justify-center px-2 h-full hover:bg-muted transition-colors text-muted-foreground"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            
            {dropdownOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] w-48 bg-popover border border-border rounded-md shadow-md z-50 py-1 text-[13px] text-popover-foreground">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Auto-Refresh</div>
                <button 
                  className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center justify-between"
                  onClick={() => { onAutoRefreshChange(null); setDropdownOpen(false); }}
                >
                  <span>Off</span>
                  {autoRefreshMs === null && <Check className="w-3.5 h-3.5" />}
                </button>
                {INTERVAL_OPTIONS.map(opt => (
                  <button 
                    key={opt.ms}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center justify-between"
                    onClick={() => { onAutoRefreshChange(opt.ms); setDropdownOpen(false); }}
                  >
                    <span>{opt.label}</span>
                    {autoRefreshMs === opt.ms && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => window.print()}
            disabled={loading}
            className="flex items-center justify-center w-[32px] h-[32px] rounded-md transition-colors disabled:opacity-50 border border-border bg-background hover:bg-muted text-foreground"
            aria-label="Export as PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsDark((d) => !d)}
            className="flex items-center justify-center w-[32px] h-[32px] rounded-md transition-colors border border-border bg-background hover:bg-muted text-foreground"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
