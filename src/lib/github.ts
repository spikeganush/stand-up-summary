/**
 * GitHub API helpers for fetching repositories and commits
 */

import { getCommitDateRange, getCommitDateRangeForDate } from "./utils";

const GITHUB_API_BASE = "https://api.github.com";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  default_branch: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  } | null;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }[];
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
}

export interface CommitWithDetails extends GitHubCommit {
  repoFullName: string;
  branchName?: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  pullRequest?: GitHubPullRequest;
}

/**
 * Create headers for GitHub API requests
 * Using the latest API version: 2022-11-28
 * https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28
 */
function createHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Fetch user's organizations
 */
async function fetchUserOrgs(
  accessToken: string
): Promise<{ login: string }[]> {
  const response = await fetch(`${GITHUB_API_BASE}/user/orgs?per_page=100`, {
    headers: createHeaders(accessToken),
  });

  if (!response.ok) {
    console.error("Failed to fetch orgs:", response.statusText);
    return [];
  }

  return response.json();
}

/**
 * Fetch repos from a specific organization
 */
async function fetchOrgRepos(
  accessToken: string,
  org: string
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `${GITHUB_API_BASE}/orgs/${org}/repos?per_page=${perPage}&page=${page}&sort=pushed&direction=desc&type=all`,
      { headers: createHeaders(accessToken) }
    );

    if (!response.ok) {
      // User might not have access to list all org repos
      console.error(
        `Failed to fetch repos for org ${org}:`,
        response.statusText
      );
      break;
    }

    const data: GitHubRepo[] = await response.json();

    if (data.length === 0) break;

    repos.push(...data);

    if (data.length < perPage) break;
    page++;

    // Limit per org
    if (repos.length >= 200) break;
  }

  return repos;
}

/**
 * Fetch user's repositories (including org repos they have access to)
 */
export async function fetchUserRepos(
  accessToken: string
): Promise<GitHubRepo[]> {
  const repoMap = new Map<number, GitHubRepo>();

  // 1. Fetch repos from /user/repos (includes owned, collaborator, org member)
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `${GITHUB_API_BASE}/user/repos?per_page=${perPage}&page=${page}&sort=pushed&direction=desc&affiliation=owner,collaborator,organization_member&visibility=all`,
      { headers: createHeaders(accessToken) }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch repos: ${response.statusText}`);
    }

    const data: GitHubRepo[] = await response.json();

    if (data.length === 0) break;

    for (const repo of data) {
      repoMap.set(repo.id, repo);
    }

    if (data.length < perPage) break;
    page++;

    if (repoMap.size >= 500) break;
  }

  // 2. Also fetch repos from each organization the user belongs to
  // This catches repos that might not be returned by /user/repos
  try {
    const orgs = await fetchUserOrgs(accessToken);

    for (const org of orgs) {
      const orgRepos = await fetchOrgRepos(accessToken, org.login);
      for (const repo of orgRepos) {
        if (!repoMap.has(repo.id)) {
          repoMap.set(repo.id, repo);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching org repos:", error);
  }

  // Sort by pushed_at date, newest first
  const repos = Array.from(repoMap.values());
  repos.sort(
    (a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
  );

  return repos;
}

/**
 * Fetch commits for a specific repository
 */
export async function fetchRepoCommits(
  accessToken: string,
  repoFullName: string,
  options?: {
    since?: string;
    until?: string;
    author?: string;
  }
): Promise<GitHubCommit[]> {
  const { since, until } = options || getCommitDateRange();

  const params = new URLSearchParams();
  if (since) params.append("since", since);
  if (until) params.append("until", until);
  if (options?.author) params.append("author", options.author);
  params.append("per_page", "100");

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${repoFullName}/commits?${params.toString()}`,
    { headers: createHeaders(accessToken) }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return []; // Repo might not exist or no access
    }
    throw new Error(`Failed to fetch commits: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch detailed commit information including stats
 */
export async function fetchCommitDetails(
  accessToken: string,
  repoFullName: string,
  sha: string
): Promise<GitHubCommit> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${repoFullName}/commits/${sha}`,
    { headers: createHeaders(accessToken) }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch commit details: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all branches for a repository
 */
export async function fetchRepoBranches(
  accessToken: string,
  repoFullName: string
): Promise<GitHubBranch[]> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${repoFullName}/branches?per_page=100`,
    { headers: createHeaders(accessToken) }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch branches: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Find which branch a commit belongs to
 */
export async function findCommitBranch(
  accessToken: string,
  repoFullName: string,
  sha: string
): Promise<string | undefined> {
  const branches = await fetchRepoBranches(accessToken, repoFullName);

  // Check each branch to see if it contains the commit
  for (const branch of branches) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${repoFullName}/compare/${sha}...${branch.name}`,
      { headers: createHeaders(accessToken) }
    );

    if (response.ok) {
      const data = await response.json();
      // If the commit is an ancestor of the branch head
      if (data.status === "ahead" || data.status === "identical") {
        return branch.name;
      }
    }
  }

  return undefined;
}

/**
 * Fetch commits with full details for multiple repositories
 */
export async function fetchCommitsForRepos(
  accessToken: string,
  repoFullNames: string[],
  userEmail?: string,
  targetDate?: Date
): Promise<CommitWithDetails[]> {
  const allCommits: CommitWithDetails[] = [];
  const dateRange = targetDate
    ? getCommitDateRangeForDate(targetDate)
    : getCommitDateRange();

  for (const repoFullName of repoFullNames) {
    try {
      const commits = await fetchRepoCommits(accessToken, repoFullName, {
        since: dateRange.since,
        until: dateRange.until,
      });

      // Filter commits by user if email provided
      const userCommits = userEmail
        ? commits.filter((c) => c.commit.author.email === userEmail)
        : commits;

      // Fetch details for each commit
      for (const commit of userCommits) {
        try {
          const [details, pullRequests] = await Promise.all([
            fetchCommitDetails(accessToken, repoFullName, commit.sha),
            fetchCommitPullRequests(accessToken, repoFullName, commit.sha),
          ]);

          allCommits.push({
            ...details,
            repoFullName,
            additions: details.stats?.additions || 0,
            deletions: details.stats?.deletions || 0,
            filesChanged: details.files?.length || 0,
            pullRequest: pullRequests[0], // Get the first/primary PR
          });
        } catch {
          // If we can't get details, use basic info
          allCommits.push({
            ...commit,
            repoFullName,
            additions: 0,
            deletions: 0,
            filesChanged: 0,
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching commits for ${repoFullName}:`, error);
    }
  }

  // Sort by date, newest first
  return allCommits.sort(
    (a, b) =>
      new Date(b.commit.author.date).getTime() -
      new Date(a.commit.author.date).getTime()
  );
}

/**
 * Fetch PRs associated with a specific commit
 */
export async function fetchCommitPullRequests(
  accessToken: string,
  repoFullName: string,
  sha: string
): Promise<GitHubPullRequest[]> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${repoFullName}/commits/${sha}/pulls`,
    { headers: createHeaders(accessToken) }
  );

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Get the authenticated user's email
 */
export async function fetchUserEmail(
  accessToken: string
): Promise<string | undefined> {
  const response = await fetch(`${GITHUB_API_BASE}/user/emails`, {
    headers: createHeaders(accessToken),
  });

  if (!response.ok) {
    return undefined;
  }

  const emails: { email: string; primary: boolean }[] = await response.json();
  const primaryEmail = emails.find((e) => e.primary);
  return primaryEmail?.email;
}
