"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatSummaryDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComplexityBadge } from "./complexity-badge";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  GitCommit,
} from "lucide-react";
import type { ComplexityMetrics } from "@/lib/llm";

interface SavedSummary {
  id: string;
  summaryDate: string;
  summaryText: string;
  totalCommits: number;
  complexityLevel: ComplexityMetrics["level"];
}

interface HistorySidebarProps {
  currentSummaryId: string;
  className?: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function HistorySidebar({
  currentSummaryId,
  className,
}: HistorySidebarProps) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [summaries, setSummaries] = useState<SavedSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to current month/year
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Generate year options (current year and 2 years back)
  const yearOptions = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  // Check if mobile on mount
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setIsCollapsed(isMobile);
  }, []);

  // Fetch summaries for the selected month/year
  const fetchSummaries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/summaries?month=${selectedMonth}&year=${selectedYear}&limit=50`
      );
      if (!response.ok) throw new Error("Failed to fetch summaries");
      const data = await response.json();
      setSummaries(data.summaries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summaries");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const handleSelectSummary = (summary: SavedSummary) => {
    router.push(`/history/${summary.id}`);
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  if (isCollapsed) {
    return (
      <div className={cn("flex flex-col items-center py-4", className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="mb-4"
          title="Expand sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full w-[280px] border-r border-border/50 bg-background/50 backdrop-blur-sm transition-all duration-300",
        className
      )}
    >
      {/* Header with collapse button */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          History
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(true)}
          className="h-8 w-8"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Month/Year Selector */}
      <div className="p-4 border-b border-border/50 space-y-3">
        {/* Month navigation with arrows */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            className="h-8 w-8 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={String(selectedMonth)}
            onValueChange={(value) => setSelectedMonth(parseInt(value))}
          >
            <SelectTrigger className="flex-1 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, index) => (
                <SelectItem key={month} value={String(index)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="h-8 w-8 shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Year selector */}
        <Select
          value={String(selectedYear)}
          onValueChange={(value) => setSelectedYear(parseInt(value))}
        >
          <SelectTrigger className="w-full h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {loading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="p-3">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4 mt-1" />
                </Card>
              ))}
            </>
          ) : error ? (
            <div className="text-center py-8 text-sm text-destructive">
              {error}
            </div>
          ) : summaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No summaries for {MONTHS[selectedMonth]}</p>
            </div>
          ) : (
            summaries.map((summary) => {
              const isActive = summary.id === currentSummaryId;
              return (
                <Card
                  key={summary.id}
                  className={cn(
                    "p-3 cursor-pointer transition-all duration-200",
                    isActive
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-accent/50 border-transparent"
                  )}
                  onClick={() => handleSelectSummary(summary)}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isActive && "text-primary"
                      )}
                    >
                      {formatSummaryDate(summary.summaryDate)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {summary.summaryText}
                  </p>
                  <div className="flex items-center gap-2">
                    <ComplexityBadge level={summary.complexityLevel} size="sm" />
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      {summary.totalCommits}
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

