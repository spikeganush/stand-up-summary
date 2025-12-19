"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatSummaryDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { History, Calendar, ChevronRight } from "lucide-react";
import { ComplexityBadge } from "./complexity-badge";
import type { ComplexityMetrics } from "@/lib/llm";

interface SavedSummary {
  id: string;
  summaryDate: string;
  summaryText: string;
  bulletPoints: string[];
  highlights: string[];
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
  complexityLevel: ComplexityMetrics["level"];
  jiraTickets: string[];
  repositories: string[];
  createdAt: string;
}

interface SummaryHistoryProps {
  className?: string;
}

export function SummaryHistory({ className }: SummaryHistoryProps) {
  const router = useRouter();
  const [summaries, setSummaries] = useState<SavedSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchSummaries() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/summaries?limit=30");
        if (!response.ok) throw new Error("Failed to fetch summaries");
        const data = await response.json();
        setSummaries(data.summaries || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    }

    if (isOpen) {
      fetchSummaries();
    }
  }, [isOpen]);

  const handleSelectSummary = (summary: SavedSummary) => {
    setIsOpen(false);
    router.push(`/history/${summary.id}`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className={className}>
          <History className="h-4 w-4" />
          <span>History</span>
          {summaries.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {summaries.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Summary History</SheetTitle>
          <SheetDescription>
            View your previous stand-up summaries.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-3/4" />
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>{error}</p>
            </div>
          ) : summaries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No saved summaries yet.</p>
              <p className="text-sm mt-2">
                Generate a summary and it will appear here.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-4">
                {summaries.map((summary) => (
                  <Card
                    key={summary.id}
                    className="p-3 cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() => handleSelectSummary(summary)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {formatSummaryDate(summary.summaryDate)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {summary.summaryText}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <ComplexityBadge
                            level={summary.complexityLevel}
                            size="sm"
                          />
                          <span className="text-xs text-muted-foreground">
                            {summary.totalCommits} commits
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
