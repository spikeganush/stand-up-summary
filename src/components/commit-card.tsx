"use client";

import { cn, getRelativeTime, truncate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, GitCommit, GitPullRequest, GitMerge, Plus, Minus, FileText } from "lucide-react";

interface JiraTicket {
  ticketId: string;
  url: string;
}

interface PullRequest {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  merged: boolean;
  baseBranch: string;
  headBranch: string;
}

interface CommitCardProps {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  repoFullName: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  jiraTickets: JiraTicket[];
  pullRequest?: PullRequest | null;
  className?: string;
}

export function CommitCard({
  sha,
  message,
  author,
  date,
  url,
  repoFullName,
  additions,
  deletions,
  filesChanged,
  jiraTickets,
  pullRequest,
  className,
}: CommitCardProps) {
  // Split message into title and body
  const [title, ...bodyParts] = message.split("\n");
  const body = bodyParts.join("\n").trim();

  return (
    <Card
      className={cn(
        "glass border-border/50 transition-all hover:border-primary/30 hover:shadow-lg",
        className
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground leading-tight">
              {truncate(title, 80)}
            </h4>
            {body && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {body}
              </p>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="View on GitHub"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* PR and Jira Tickets */}
        {(pullRequest || jiraTickets.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {pullRequest && (
              <a
                href={pullRequest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-xs transition-colors cursor-pointer flex items-center gap-1",
                    pullRequest.merged
                      ? "border-purple-500/50 text-purple-500 hover:bg-purple-500/10"
                      : pullRequest.state === "open"
                      ? "border-green-500/50 text-green-500 hover:bg-green-500/10"
                      : "border-red-500/50 text-red-500 hover:bg-red-500/10"
                  )}
                >
                  {pullRequest.merged ? (
                    <GitMerge className="h-3 w-3" />
                  ) : (
                    <GitPullRequest className="h-3 w-3" />
                  )}
                  #{pullRequest.number}
                </Badge>
              </a>
            )}
            {jiraTickets.map((ticket) => (
              <a
                key={ticket.ticketId}
                href={ticket.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Badge
                  variant="secondary"
                  className="font-mono text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                >
                  {ticket.ticketId}
                </Badge>
              </a>
            ))}
          </div>
        )}

        {/* Stats Row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <GitCommit className="h-3 w-3" />
              <code className="font-mono">{sha.slice(0, 7)}</code>
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>{repoFullName.split("/")[1]}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-green-500">
              <Plus className="h-3 w-3" />
              <span className="font-mono">{additions}</span>
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <Minus className="h-3 w-3" />
              <span className="font-mono">{deletions}</span>
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="font-mono">{filesChanged}</span>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>{author}</span>
          <span>{getRelativeTime(new Date(date))}</span>
        </div>
      </CardContent>
    </Card>
  );
}

