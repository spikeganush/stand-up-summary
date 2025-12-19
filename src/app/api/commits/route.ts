import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  fetchCommitsForRepos,
  fetchUserEmail,
  fetchCommitDiff,
  groupCommitsByTicket,
  type FormattedCommit,
  type CommitDiff,
} from "@/lib/github";
import { extractAllJiraTickets } from "@/lib/jira";
import { calculateComplexity } from "@/lib/llm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const body = await request.json();
    const { repos, githubPat, date, jiraBaseUrl, includeDiffs = true } = body;

    // Use PAT if provided, otherwise use OAuth token
    const accessToken = githubPat || session?.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!repos || !Array.isArray(repos) || repos.length === 0) {
      return NextResponse.json(
        { error: "No repositories specified" },
        { status: 400 }
      );
    }

    // Get user's email to filter commits
    const userEmail = await fetchUserEmail(accessToken);

    // Parse the target date if provided
    const targetDate = date ? new Date(date) : undefined;

    // Fetch commits for all selected repos
    const commits = await fetchCommitsForRepos(
      accessToken,
      repos,
      userEmail,
      targetDate
    );

    // Calculate overall complexity
    const complexity = calculateComplexity(commits);

    // Group commits by repository
    const commitsByRepo = repos.reduce((acc, repo) => {
      acc[repo] = commits.filter((c) => c.repoFullName === repo);
      return acc;
    }, {} as Record<string, typeof commits>);

    // Fetch diffs for each commit (in parallel, with concurrency limit)
    const diffMap = new Map<string, CommitDiff>();

    if (includeDiffs) {
      const diffPromises = commits.map(async (commit) => {
        try {
          const diff = await fetchCommitDiff(
            accessToken,
            commit.repoFullName,
            commit.sha,
            50 // Limit to 50 lines per file for token efficiency
          );
          return { sha: commit.sha, diff };
        } catch {
          return { sha: commit.sha, diff: null };
        }
      });

      const diffs = await Promise.all(diffPromises);
      diffs.forEach(({ sha, diff }) => {
        if (diff) {
          diffMap.set(sha, diff);
        }
      });
    }

    // Format commits for response with branch info from PRs
    const formattedCommits: FormattedCommit[] = commits.map((commit) => {
      const branchName = commit.pullRequest?.head?.ref || commit.branchName;

      return {
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        authorEmail: commit.commit.author.email,
        date: commit.commit.author.date,
        url: commit.html_url,
        repoFullName: commit.repoFullName,
        additions: commit.additions,
        deletions: commit.deletions,
        filesChanged: commit.filesChanged,
        branchName,
        jiraTickets: extractAllJiraTickets(
          {
            branchName,
            prTitle: commit.pullRequest?.title,
            commitMessages: [commit.commit.message],
          },
          jiraBaseUrl
        ),
        pullRequest: commit.pullRequest
          ? {
              number: commit.pullRequest.number,
              title: commit.pullRequest.title,
              url: commit.pullRequest.html_url,
              state: commit.pullRequest.state,
              merged: !!commit.pullRequest.merged_at,
              baseBranch: commit.pullRequest.base.ref,
              headBranch: commit.pullRequest.head.ref,
            }
          : null,
        diff: diffMap.get(commit.sha),
      };
    });

    // Group commits by Jira ticket
    const { ticketGroups, orphanCommits } = groupCommitsByTicket(
      formattedCommits,
      jiraBaseUrl
    );

    // Extract unique PRs from commits
    const prMap = new Map<
      number,
      NonNullable<FormattedCommit["pullRequest"]>
    >();
    for (const commit of formattedCommits) {
      if (commit.pullRequest && !prMap.has(commit.pullRequest.number)) {
        prMap.set(commit.pullRequest.number, commit.pullRequest);
      }
    }
    const pullRequests = Array.from(prMap.values());

    // Collect all unique Jira tickets
    const ticketSet = new Set<string>();
    ticketGroups.forEach((group) => ticketSet.add(group.ticketId));
    const jiraTickets = Array.from(ticketSet).map((ticketId) => ({
      ticketId,
      url: ticketGroups.find((g) => g.ticketId === ticketId)?.ticketUrl || "",
    }));

    return NextResponse.json({
      commits: formattedCommits,
      commitsByRepo,
      jiraTickets,
      pullRequests,
      complexity,
      totalCommits: commits.length,
      usingPat: !!githubPat,
      // New ticket-grouped data
      ticketGroups,
      orphanCommits,
    });
  } catch (error) {
    console.error("Error fetching commits:", error);
    return NextResponse.json(
      { error: "Failed to fetch commits" },
      { status: 500 }
    );
  }
}
