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
  ExternalLink,
  Save,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import type { SummaryResult, TicketSummary } from "@/lib/llm";
import { getJiraUrl } from "@/lib/jira";

interface JiraTicket {
  ticketId: string;
  url: string;
}

interface SummaryPanelProps {
  summary: SummaryResult | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  onSave?: () => Promise<void>;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  saveError?: string | null;
  jiraTickets?: JiraTicket[];
  className?: string;
}

function TicketCard({ ticket }: { ticket: TicketSummary }) {
  const ticketUrl = getJiraUrl(ticket.ticketId);

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
      <div className="flex items-center gap-3 mb-3">
        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-semibold hover:bg-primary/90 transition-colors group"
        >
          {ticket.ticketId}
          <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>
      <p className="text-foreground font-medium mb-2">{ticket.summary}</p>
      {ticket.bulletPoints.length > 0 && (
        <ul className="space-y-1.5">
          {ticket.bulletPoints.map((point, index) => (
            <li
              key={index}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SummaryPanel({
  summary,
  loading,
  error,
  onRetry,
  onSave,
  saveStatus = "idle",
  saveError,
  jiraTickets = [],
  className,
}: SummaryPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!summary) return;

    // Build copy text with ticket structure
    let text = summary.summary + "\n\n";
    
    if (summary.tickets && summary.tickets.length > 0) {
      summary.tickets.forEach((ticket) => {
        text += `${ticket.ticketId}: ${ticket.summary}\n`;
        ticket.bulletPoints.forEach((point) => {
          text += `  • ${point}\n`;
        });
        text += "\n";
      });
    }
    
    if (summary.untracked && summary.untracked.length > 0) {
      text += "Other work:\n";
      summary.untracked.forEach((item) => {
        text += `  • ${item}\n`;
      });
    }

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
      <Card className={cn("glass border-primary/30 glow", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Sparkles className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl">Generating Summary...</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Analyzing your commits and organizing by Jira tickets
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("glass border-destructive/30", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 text-destructive">
            <div className="p-2 rounded-lg bg-destructive/20">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Summary Error</CardTitle>
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
    // Show empty state with Jira tickets if available
    if (jiraTickets.length > 0) {
      return (
        <Card className={cn("glass border-border/50", className)}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">Ready to Summarize</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {jiraTickets.length} Jira ticket{jiraTickets.length !== 1 ? "s" : ""} detected
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {jiraTickets.map((ticket) => (
                <a
                  key={ticket.ticketId}
                  href={ticket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-mono text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  {ticket.ticketId}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  const hasTickets = summary.tickets && summary.tickets.length > 0;
  const hasUntracked = summary.untracked && summary.untracked.length > 0;

  return (
    <Card className={cn("glass border-primary/30 glow", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl gradient-text">
                Stand-up Summary
              </CardTitle>
              {hasTickets && (
                <p className="text-sm text-muted-foreground mt-1">
                  {summary.tickets!.length} ticket{summary.tickets!.length !== 1 ? "s" : ""} worked on
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
                className="gap-2"
              >
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : saveStatus === "saved" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            )}
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
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Save error */}
        {saveStatus === "error" && saveError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            Failed to save: {saveError}
          </div>
        )}

        {/* Overview */}
        <p className="text-lg text-foreground leading-relaxed font-medium">
          {summary.summary}
        </p>

        {/* Ticket-based summaries */}
        {hasTickets && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              By Ticket
            </h3>
            <div className="space-y-3">
              {summary.tickets!.map((ticket) => (
                <TicketCard key={ticket.ticketId} ticket={ticket} />
              ))}
            </div>
          </div>
        )}

        {/* Untracked work */}
        {hasUntracked && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Other Work
            </h3>
            <ul className="space-y-2">
              {summary.untracked!.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="text-muted-foreground/60 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Legacy bullet points (fallback for non-ticket summaries) */}
        {!hasTickets && summary.bulletPoints.length > 0 && (
          <ul className="space-y-2">
            {summary.bulletPoints.map((point, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-primary mt-0.5">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Highlights */}
        {summary.highlights.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-semibold">
              Highlights
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.highlights.map((highlight, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1"
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
