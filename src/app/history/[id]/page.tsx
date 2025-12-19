"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ComplexityBadge, ComplexityStats } from "@/components/complexity-badge";
import { CommitCard } from "@/components/commit-card";
import { HistorySidebar } from "@/components/history-sidebar";
import { formatDate, formatSummaryDate } from "@/lib/utils";
import type { ComplexityMetrics, TicketSummary } from "@/lib/llm";
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  GitCommit,
  GitPullRequest,
  GitMerge,
  ExternalLink,
  AlertCircle,
  Plus,
  Minus,
  FileText,
  Code2,
  FileCode,
  Trash2,
  Loader2,
} from "lucide-react";

interface PullRequestData {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  merged: boolean;
  baseBranch: string;
  headBranch: string;
}

interface CommitData {
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  url: string;
  repoFullName: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  branchName?: string;
  jiraTickets: { ticketId: string; url: string }[];
  pullRequest: PullRequestData | null;
}

interface SavedSummary {
  id: string;
  summaryDate: string;
  summaryText: string;
  bulletPoints: string[];
  highlights: string[];
  ticketSummaries: TicketSummary[] | null;
  untracked: string[];
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
  complexityLevel: ComplexityMetrics["level"];
  jiraTickets: string[];
  repositories: string[];
  commitsData: CommitData[] | null;
  pullRequestsData: PullRequestData[] | null;
  llmProvider: string | null;
  createdAt: string;
}

export default function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { status } = useSession();
  const router = useRouter();

  const [summary, setSummary] = useState<SavedSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Fetch the summary
  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/summaries/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Summary not found");
          }
          throw new Error("Failed to fetch summary");
        }
        const data = await response.json();
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load summary");
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated" && id) {
      fetchSummary();
    }
  }, [status, id]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/summaries/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete summary");
      }
      const data = await response.json();
      setDeleteDialogOpen(false);
      
      // Navigate to the next closest summary, or dashboard if none left
      if (data.nextId) {
        router.push(`/history/${data.nextId}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to delete summary:", err);
      setDeleting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen dark animated-gradient flex">
        {/* Sidebar skeleton */}
        <div className="hidden md:block w-[280px] border-r border-border/50 bg-background/50 p-4">
          <Skeleton className="h-6 w-20 mb-4" />
          <Skeleton className="h-9 w-full mb-3" />
          <Skeleton className="h-9 w-full mb-6" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1">
          <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-6 w-48" />
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 py-8">
            <div className="space-y-6">
              <Card className="glass border-border/50">
                <CardHeader>
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-48 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen dark animated-gradient flex">
        {/* Sidebar */}
        <HistorySidebar currentSummaryId={id} className="hidden md:flex shrink-0" />

        {/* Main content */}
        <div className="flex-1">
          <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold">Summary History</h1>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 py-8">
            <Card className="glass border-destructive/30">
              <CardContent className="py-16 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{error}</h3>
                <p className="text-muted-foreground mb-6">
                  The summary you&apos;re looking for could not be found.
                </p>
                <Link href="/dashboard">
                  <Button>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const commits = summary.commitsData || [];
  const complexityMetrics: ComplexityMetrics = {
    level: summary.complexityLevel,
    totalCommits: summary.totalCommits,
    totalAdditions: summary.totalAdditions,
    totalDeletions: summary.totalDeletions,
    totalFilesChanged: summary.totalFiles,
    averageAdditionsPerCommit:
      summary.totalCommits > 0
        ? summary.totalAdditions / summary.totalCommits
        : 0,
    averageDeletionsPerCommit:
      summary.totalCommits > 0
        ? summary.totalDeletions / summary.totalCommits
        : 0,
    averageFilesPerCommit:
      summary.totalCommits > 0 ? summary.totalFiles / summary.totalCommits : 0,
  };

  return (
    <div className="min-h-screen dark animated-gradient flex">
      {/* Sidebar */}
      <HistorySidebar currentSummaryId={id} className="shrink-0 h-screen sticky top-0" />

      {/* Main content wrapper */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Summary History</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">
                {formatSummaryDate(summary.summaryDate)}
              </span>
              </div>

              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Summary</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this summary from{" "}
                    {formatSummaryDate(summary.summaryDate)}? This action cannot be undone.
                  </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Summary Card */}
          <Card className="glass border-primary/30 glow">
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
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatSummaryDate(summary.summaryDate)}
                    </p>
                  </div>
                </div>
                <ComplexityBadge level={summary.complexityLevel} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Text */}
              <p className="text-lg text-foreground leading-relaxed font-medium">
                {summary.summaryText}
              </p>

              {/* Ticket-based Summaries */}
              {summary.ticketSummaries && summary.ticketSummaries.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    By Ticket
                  </h3>
                  <div className="space-y-3">
                    {summary.ticketSummaries.map((ticket) => (
                      <div
                        key={ticket.ticketId}
                        className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-4"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <Badge className="bg-primary text-primary-foreground font-mono text-sm font-semibold px-3 py-1.5">
                            {ticket.ticketId}
                          </Badge>
                        </div>
                        <p className="text-foreground font-medium mb-2">
                          {ticket.summary}
                        </p>
                        {ticket.bulletPoints.length > 0 && (
                          <ul className="space-y-1.5 mb-3">
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
                        {ticket.codeInsights && ticket.codeInsights.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-primary/10">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                              <Code2 className="h-3.5 w-3.5" />
                              Code Insights
                            </div>
                            <ul className="space-y-1">
                              {ticket.codeInsights.map((insight, index) => (
                                <li key={index} className="text-xs text-muted-foreground/80">
                                  → {insight}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ticket.filesChanged && ticket.filesChanged.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-primary/10">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                              <FileCode className="h-3.5 w-3.5" />
                              Files Modified ({ticket.filesChanged.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {ticket.filesChanged.slice(0, 8).map((file, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="text-xs font-mono py-0.5"
                                >
                                  {file.split("/").pop()}
                                </Badge>
                              ))}
                              {ticket.filesChanged.length > 8 && (
                                <Badge variant="outline" className="text-xs py-0.5">
                                  +{ticket.filesChanged.length - 8} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : summary.bulletPoints.length > 0 ? (
                /* Legacy Bullet Points - fallback when no ticket summaries */
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Key Points
                  </h3>
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
                </div>
              ) : null}

              {/* Untracked Work */}
              {summary.untracked && summary.untracked.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Other Work
                  </h3>
                  <ul className="space-y-2">
                    {summary.untracked.map((item, index) => (
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

              {/* Jira Tickets - only show if no ticket summaries (legacy view) */}
              {(!summary.ticketSummaries || summary.ticketSummaries.length === 0) && summary.jiraTickets.length > 0 && (
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-semibold">
                    Jira Tickets
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {summary.jiraTickets.map((ticket) => (
                      <Badge
                        key={ticket}
                        variant="secondary"
                        className="font-mono text-xs"
                      >
                        {ticket}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{summary.totalCommits}</span>
                    <span className="text-muted-foreground">commits</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-500">
                    <Plus className="h-4 w-4" />
                    <span className="font-mono">{summary.totalAdditions}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-500">
                    <Minus className="h-4 w-4" />
                    <span className="font-mono">{summary.totalDeletions}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="font-mono">{summary.totalFiles}</span>
                    <span>files</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grid for Complexity and Commits */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Complexity Stats */}
            <div className="lg:col-span-1">
              <Card className="glass border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Complexity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ComplexityStats metrics={complexityMetrics} />
                </CardContent>
              </Card>

              {/* Pull Requests */}
              {summary.pullRequestsData && summary.pullRequestsData.length > 0 && (
                <Card className="glass border-border/50 mt-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GitPullRequest className="h-5 w-5" />
                      Pull Requests
                      <span className="text-sm font-normal text-muted-foreground">
                        ({summary.pullRequestsData.length})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {summary.pullRequestsData.map((pr) => (
                        <a
                          key={pr.number}
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {pr.merged ? (
                                  <GitMerge className="h-4 w-4 text-purple-500 shrink-0" />
                                ) : pr.state === "open" ? (
                                  <GitPullRequest className="h-4 w-4 text-green-500 shrink-0" />
                                ) : (
                                  <GitPullRequest className="h-4 w-4 text-red-500 shrink-0" />
                                )}
                                <span className="font-mono text-sm text-muted-foreground">
                                  #{pr.number}
                                </span>
                              </div>
                              <p className="text-sm font-medium line-clamp-2">
                                {pr.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {pr.headBranch} → {pr.baseBranch}
                              </p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Repositories */}
              {summary.repositories.length > 0 && (
                <Card className="glass border-border/50 mt-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Repositories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summary.repositories.map((repo) => (
                        <a
                          key={repo}
                          href={`https://github.com/${repo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2 rounded-lg bg-accent/50 hover:bg-accent transition-colors group"
                        >
                          <span className="text-sm font-mono truncate">
                            {repo}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Commits */}
            <div className="lg:col-span-2">
              <Card className="glass border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GitCommit className="h-5 w-5" />
                    Commits
                    {commits.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({commits.length})
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {commits.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <GitCommit className="h-8 w-8 mx-auto mb-3 opacity-50" />
                      <p>No commit data stored for this summary.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {commits.map((commit) => (
                          <CommitCard key={commit.sha} {...commit} />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}

