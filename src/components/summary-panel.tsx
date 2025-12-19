"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import type { SummaryResult } from "@/lib/llm";

interface SummaryPanelProps {
  summary: SummaryResult | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  className?: string;
}

export function SummaryPanel({
  summary,
  loading,
  error,
  onRetry,
  className,
}: SummaryPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!summary) return;

    const text = `${summary.summary}\n\n${summary.bulletPoints.map((p) => `• ${p}`).join("\n")}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <Card className={cn("glass border-primary/20", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle className="text-lg">Generating Summary...</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("glass border-destructive/30", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <CardTitle className="text-lg">Summary Error</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <Card className={cn("glass border-primary/20 glow", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg gradient-text">
              AI Summary
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overview */}
        <p className="text-foreground leading-relaxed">{summary.summary}</p>

        {/* Bullet Points */}
        {summary.bulletPoints.length > 0 && (
          <ul className="space-y-2">
            {summary.bulletPoints.map((point, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-primary mt-1.5">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Highlights */}
        {summary.highlights.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
              Highlights
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.highlights.map((highlight, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {highlight}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

