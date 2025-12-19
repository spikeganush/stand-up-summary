"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RepoSelector } from "@/components/repo-selector";
import { LLMSettings } from "@/components/llm-settings";
import { CommitCard } from "@/components/commit-card";
import { SummaryPanel } from "@/components/summary-panel";
import { ComplexityStats } from "@/components/complexity-badge";
import { SummaryHistory } from "@/components/summary-history";
import { DatePicker } from "@/components/date-picker";
import { useSettingsStore } from "@/stores/settings-store";
import { getPreviousWorkingDay } from "@/lib/utils";
import type { SummaryResult, ComplexityMetrics } from "@/lib/llm";
import {
  Sparkles,
  LogOut,
  RefreshCw,
  GitCommit,
  GitPullRequest,
  GitMerge,
  AlertCircle,
  ExternalLink,
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
  jiraTickets: { ticketId: string; url: string }[];
  pullRequest: PullRequestData | null;
}

interface JiraTicket {
  ticketId: string;
  url: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { selectedRepos, llmProvider, apiKeys, githubPat, useGithubPat } = useSettingsStore();

  const [commits, setCommits] = useState<CommitData[]>([]);
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequestData[]>([]);
  const [complexity, setComplexity] = useState<ComplexityMetrics | null>(null);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(() => getPreviousWorkingDay());

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Fetch commits when repos change
  const fetchCommits = useCallback(async () => {
    if (selectedRepos.length === 0) {
      setCommits([]);
      setJiraTickets([]);
      setPullRequests([]);
      setComplexity(null);
      return;
    }

    setLoadingCommits(true);
    setCommitsError(null);

    try {
      const response = await fetch("/api/commits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          repos: selectedRepos,
          githubPat: useGithubPat ? githubPat : undefined,
          date: selectedDate.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch commits");
      }

      const data = await response.json();
      setCommits(data.commits);
      setJiraTickets(data.jiraTickets);
      setPullRequests(data.pullRequests || []);
      setComplexity(data.complexity);
    } catch (err) {
      setCommitsError(
        err instanceof Error ? err.message : "Failed to fetch commits"
      );
    } finally {
      setLoadingCommits(false);
    }
  }, [selectedRepos, useGithubPat, githubPat, selectedDate]);

  useEffect(() => {
    if (status === "authenticated" && selectedRepos.length > 0) {
      fetchCommits();
    }
  }, [status, selectedRepos, fetchCommits]);

  // Save summary to database
  const saveSummary = useCallback(async (summaryData: SummaryResult) => {
    setSaveStatus("saving");
    setSaveError(null);

    try {
      const response = await fetch("/api/summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryDate: selectedDate.toISOString(),
          summaryText: summaryData.summary,
          bulletPoints: summaryData.bulletPoints || [],
          highlights: summaryData.highlights || [],
          totalCommits: complexity?.totalCommits || commits.length,
          totalAdditions: complexity?.totalAdditions || 0,
          totalDeletions: complexity?.totalDeletions || 0,
          totalFiles: complexity?.totalFilesChanged || 0,
          complexityLevel: complexity?.level || "simple",
          jiraTickets: jiraTickets.map((t) => t.ticketId),
          repositories: selectedRepos,
          commitsData: commits,
          llmProvider,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save summary");
      }

      setSaveStatus("saved");
      // Reset to idle after a delay
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Failed to save summary:", err);
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Failed to save summary");
    }
  }, [selectedDate, complexity, commits, jiraTickets, selectedRepos, llmProvider]);

  // Manual save handler
  const handleManualSave = useCallback(async () => {
    if (summary) {
      await saveSummary(summary);
    }
  }, [summary, saveSummary]);

  // Generate summary
  const generateSummary = useCallback(async () => {
    const apiKey = apiKeys[llmProvider];

    if (!apiKey) {
      setSummaryError(
        `Please configure your ${llmProvider.toUpperCase()} API key in settings.`
      );
      return;
    }

    if (commits.length === 0) {
      setSummaryError("No commits to summarize.");
      return;
    }

    setLoadingSummary(true);
    setSummaryError(null);
    setSaveStatus("idle");
    setSaveError(null);

    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commits,
          provider: llmProvider,
          apiKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate summary");
      }

      const data = await response.json();
      setSummary(data.summary);

      // Auto-save summary to database
      await saveSummary(data.summary);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : "Failed to generate summary"
      );
    } finally {
      setLoadingSummary(false);
    }
  }, [commits, llmProvider, apiKeys, saveSummary]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center dark animated-gradient">
        <div className="animate-pulse flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <span className="text-xl font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen dark animated-gradient">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Stand-up Summary</h1>
          </div>

          <div className="flex items-center gap-3">
            <RepoSelector />
            <SummaryHistory />
            <LLMSettings />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={session.user?.image || ""}
                      alt={session.user?.name || ""}
                    />
                    <AvatarFallback>
                      {session.user?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{session.user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Date Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <DatePicker
              date={selectedDate}
              onDateChange={setSelectedDate}
              disabled={loadingCommits}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCommits}
              disabled={loadingCommits || selectedRepos.length === 0}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loadingCommits ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              onClick={generateSummary}
              disabled={
                loadingSummary || commits.length === 0 || !apiKeys[llmProvider]
              }
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Summary
            </Button>
          </div>
        </div>

        {/* No repos selected state */}
        {selectedRepos.length === 0 && (
          <Card className="glass border-border/50">
            <CardContent className="py-16 text-center">
              <GitCommit className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No repositories selected</h3>
              <p className="text-muted-foreground mb-6">
                Select the repositories you want to track for your stand-up
                summary.
              </p>
              <RepoSelector />
            </CardContent>
          </Card>
        )}

        {/* Content - Summary First */}
        {selectedRepos.length > 0 && (
          <div className="space-y-8">
            {/* Hero Summary Panel - Full Width */}
            <SummaryPanel
              summary={summary}
              loading={loadingSummary}
              error={summaryError}
              onRetry={generateSummary}
              onSave={handleManualSave}
              saveStatus={saveStatus}
              saveError={saveError}
              jiraTickets={jiraTickets}
              className="w-full"
            />

            {/* Secondary Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column - PRs and Stats */}
              <div className="lg:col-span-1 space-y-6">
                {/* Pull Requests */}
                {pullRequests.length > 0 && (
                  <Card className="glass border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <GitPullRequest className="h-5 w-5" />
                        Pull Requests
                        <span className="text-sm font-normal text-muted-foreground">
                          ({pullRequests.length})
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {pullRequests.map((pr) => (
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

                {/* Complexity Stats */}
                {complexity && (
                  <Card className="glass border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Complexity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ComplexityStats metrics={complexity} />
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column - Commits List */}
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
                    {loadingCommits ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="space-y-3">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <div className="flex gap-2">
                              <Skeleton className="h-6 w-16" />
                              <Skeleton className="h-6 w-16" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : commitsError ? (
                      <div className="text-center py-8">
                        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                        <p className="text-destructive">{commitsError}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={fetchCommits}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : commits.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <GitCommit className="h-8 w-8 mx-auto mb-3 opacity-50" />
                        <p>No commits found for the selected date.</p>
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
        )}
      </main>
    </div>
  );
}
