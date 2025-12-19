import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchCommitsForRepos, fetchUserEmail } from "@/lib/github";
import { extractAllJiraTickets } from "@/lib/jira";
import { calculateComplexity } from "@/lib/llm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const body = await request.json();
    const { repos, githubPat, date } = body;

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

    // Extract Jira tickets from all commits
    const allTickets = extractAllJiraTickets({
      commitMessages: commits.map((c) => c.commit.message),
    });

    // Calculate overall complexity
    const complexity = calculateComplexity(commits);

    // Group commits by repository
    const commitsByRepo = repos.reduce(
      (acc, repo) => {
        acc[repo] = commits.filter((c) => c.repoFullName === repo);
        return acc;
      },
      {} as Record<string, typeof commits>
    );

    // Format commits for response
    const formattedCommits = commits.map((commit) => ({
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
      jiraTickets: extractAllJiraTickets({
        commitMessages: [commit.commit.message],
      }),
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
    }));

    // Extract unique PRs from commits
    const prMap = new Map<number, (typeof formattedCommits)[0]["pullRequest"]>();
    for (const commit of formattedCommits) {
      if (commit.pullRequest && !prMap.has(commit.pullRequest.number)) {
        prMap.set(commit.pullRequest.number, commit.pullRequest);
      }
    }
    const pullRequests = Array.from(prMap.values());

    return NextResponse.json({
      commits: formattedCommits,
      commitsByRepo,
      jiraTickets: allTickets,
      pullRequests,
      complexity,
      totalCommits: commits.length,
      usingPat: !!githubPat,
    });
  } catch (error) {
    console.error("Error fetching commits:", error);
    return NextResponse.json(
      { error: "Failed to fetch commits" },
      { status: 500 }
    );
  }
}
