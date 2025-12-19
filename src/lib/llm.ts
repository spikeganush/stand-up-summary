/**
 * Multi-provider LLM client for generating commit summaries
 */

import type { CommitWithDetails, TicketGroup, CommitDiff } from "./github";
import { extractJiraTickets, extractTicketFromBranch } from "./jira";
import type { LLMProvider } from "@/stores/settings-store";

export interface TicketSummary {
  ticketId: string;
  summary: string;
  bulletPoints: string[];
  codeInsights?: string[];
  filesChanged?: string[];
}

export interface SummaryResult {
  summary: string;
  bulletPoints: string[];
  highlights: string[];
  tickets?: TicketSummary[];
  untracked?: string[];
}

/**
 * Flattened commit data structure (as sent from the frontend)
 */
interface FlattenedCommit {
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
  pullRequest?: {
    number: number;
    title: string;
    url: string;
    state: "open" | "closed";
    merged: boolean;
    baseBranch: string;
    headBranch: string;
  } | null;
  diff?: CommitDiff;
}

/**
 * Format a diff for the prompt (truncated for token efficiency)
 */
function formatDiffForPrompt(diff: CommitDiff, maxFiles: number = 5): string {
  if (!diff.files || diff.files.length === 0) {
    return "";
  }

  const files = diff.files.slice(0, maxFiles);
  let diffText = "";

  for (const file of files) {
    diffText += `\n  File: ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})\n`;
    if (file.patch) {
      // Only include first 30 lines of patch for token efficiency
      const patchLines = file.patch.split("\n").slice(0, 30);
      diffText += "  ```\n";
      diffText += patchLines.map((line) => `  ${line}`).join("\n");
      if (file.patch.split("\n").length > 30) {
        diffText += "\n  ... (truncated)";
      }
      diffText += "\n  ```\n";
    }
  }

  if (diff.files.length > maxFiles) {
    diffText += `\n  ... and ${diff.files.length - maxFiles} more files\n`;
  }

  return diffText;
}

/**
 * Build a prompt for the LLM to summarize commits with code diffs
 * Accepts either flattened commits (from frontend) or ticket groups
 */
function buildPromptWithDiffs(
  commits: FlattenedCommit[],
  ticketGroups?: TicketGroup[]
): string {
  // If we have pre-grouped ticket data, use it
  if (ticketGroups && ticketGroups.length > 0) {
    return buildPromptFromTicketGroups(ticketGroups, commits);
  }

  // Otherwise, group commits by ticket ourselves
  return buildPromptFromCommits(commits);
}

/**
 * Build prompt from pre-grouped ticket data (with diffs)
 */
function buildPromptFromTicketGroups(
  ticketGroups: TicketGroup[],
  allCommits: FlattenedCommit[]
): string {
  let commitDetails = "";

  // Format each ticket group with its diffs
  for (const group of ticketGroups) {
    commitDetails += `\n## Ticket: ${group.ticketId}\n`;
    commitDetails += `URL: ${group.ticketUrl}\n`;
    commitDetails += `Total changes: +${group.totalAdditions}/-${group.totalDeletions} across ${group.filesChanged.length} files\n`;

    // List PRs for this ticket
    if (group.pullRequests.length > 0) {
      commitDetails += `\nPull Requests:\n`;
      for (const pr of group.pullRequests) {
        const status = pr.merged ? "MERGED" : pr.state.toUpperCase();
        commitDetails += `  - PR #${pr.number}: ${pr.title} [${status}]\n`;
        commitDetails += `    Branch: ${pr.headBranch} → ${pr.baseBranch}\n`;
      }
    }

    // List commits for this ticket
    commitDetails += `\nCommits:\n`;
    for (const commit of group.commits) {
      const shortSha = commit.sha.substring(0, 7);
      commitDetails += `  - [${shortSha}] ${commit.message.split("\n")[0]} (+${
        commit.additions
      }/-${commit.deletions})\n`;
    }

    // Include code diffs
    if (group.diffs.length > 0) {
      commitDetails += `\nCode Changes:\n`;
      for (const diff of group.diffs.slice(0, 3)) {
        // Limit to 3 diffs per ticket
        commitDetails += formatDiffForPrompt(diff, 3);
      }
    }

    // List files changed
    if (group.filesChanged.length > 0) {
      commitDetails += `\nFiles modified: ${group.filesChanged
        .slice(0, 10)
        .join(", ")}`;
      if (group.filesChanged.length > 10) {
        commitDetails += ` ... and ${group.filesChanged.length - 10} more`;
      }
      commitDetails += "\n";
    }
  }

  // Find orphan commits (not in any ticket group)
  const ticketCommitShas = new Set(
    ticketGroups.flatMap((g) => g.commits.map((c) => c.sha))
  );
  const orphanCommits = allCommits.filter((c) => !ticketCommitShas.has(c.sha));

  if (orphanCommits.length > 0) {
    commitDetails += `\n## Other Work (no Jira ticket identified)\n`;
    for (const commit of orphanCommits) {
      const shortSha = commit.sha.substring(0, 7);
      commitDetails += `  - [${shortSha}] ${commit.message.split("\n")[0]} (+${
        commit.additions
      }/-${commit.deletions})\n`;
      if (commit.diff) {
        commitDetails += formatDiffForPrompt(commit.diff, 2);
      }
    }
  }

  const ticketList = ticketGroups.map((g) => g.ticketId);

  return `You are a helpful assistant that summarizes daily development work for stand-up meetings.
Your summaries should be ORGANIZED BY JIRA TICKET and provide MEANINGFUL CODE-LEVEL INSIGHTS, not just commit titles.

Given the following development activity from yesterday, create a comprehensive Jira-ticket-focused summary.

${commitDetails}

IMPORTANT GUIDELINES:
1. Structure your response around Jira tickets - each ticket should have its own detailed summary
2. Analyze the actual CODE CHANGES shown in the diffs to understand what was implemented
3. Don't just repeat commit messages - synthesize what was actually built or fixed
4. Identify patterns: new features, bug fixes, refactoring, API changes, UI updates
5. For each ticket, describe the business value or technical improvement achieved
6. Highlight significant architectural decisions or complex implementations

Please provide your response in the following JSON format:
{
  "summary": "A 1-2 sentence high-level overview mentioning the main tickets and key accomplishments",
  "tickets": [
    ${ticketList
      .map(
        (t) => `{
      "ticketId": "${t}",
      "summary": "Detailed description of what was accomplished (based on code analysis)",
      "bulletPoints": ["Specific implementation detail 1", "Specific implementation detail 2"],
      "codeInsights": ["Technical insight about the code changes"],
      "filesChanged": ["key-file-1.ts", "key-file-2.tsx"]
    }`
      )
      .join(",\n    ")}
  ],
  "untracked": ["Description of work not associated with a ticket, with technical details"],
  "bulletPoints": ["Overall key points for quick stand-up delivery"],
  "highlights": ["Major achievement or notable technical accomplishment"]
}

Focus on:
- What new functionality was added?
- What bugs were fixed and how?
- What was refactored or improved?
- What APIs or interfaces were modified?
- What UI/UX changes were made?`;
}

/**
 * Build prompt from commits (legacy method, without pre-grouped tickets)
 */
function buildPromptFromCommits(commits: FlattenedCommit[]): string {
  // Group commits by Jira ticket
  const ticketCommits: Record<string, FlattenedCommit[]> = {};
  const untrackedCommits: FlattenedCommit[] = [];

  commits.forEach((c) => {
    // Try to extract ticket from branch name first
    let tickets: string[] = [];

    if (c.branchName) {
      const branchTicket = extractTicketFromBranch(c.branchName);
      if (branchTicket) {
        tickets.push(branchTicket);
      }
    }

    if (c.pullRequest?.headBranch) {
      const prBranchTicket = extractTicketFromBranch(c.pullRequest.headBranch);
      if (prBranchTicket) {
        tickets.push(prBranchTicket);
      }
    }

    // Also check commit message
    const messageTickets = extractJiraTickets(c.message);
    tickets = [...new Set([...tickets, ...messageTickets])];

    if (tickets.length > 0) {
      tickets.forEach((ticket) => {
        if (!ticketCommits[ticket]) {
          ticketCommits[ticket] = [];
        }
        ticketCommits[ticket].push(c);
      });
    } else {
      untrackedCommits.push(c);
    }
  });

  const formatCommit = (c: FlattenedCommit) => {
    let text = `  - ${c.message.split("\n")[0]} (${c.filesChanged} files, +${
      c.additions
    }/-${c.deletions})`;
    if (c.pullRequest) {
      text += `\n    PR #${c.pullRequest.number}: ${c.pullRequest.title}`;
    }
    if (c.diff) {
      text += formatDiffForPrompt(c.diff, 3);
    }
    return text;
  };

  let commitDetails = "";

  // Format ticket-grouped commits
  Object.entries(ticketCommits).forEach(([ticket, ticketCommitList]) => {
    commitDetails += `\n## Ticket: ${ticket}\n`;
    ticketCommitList.forEach((c) => {
      commitDetails += formatCommit(c) + "\n";
    });
  });

  // Format untracked commits
  if (untrackedCommits.length > 0) {
    commitDetails += `\n## Untracked Work (no Jira ticket)\n`;
    untrackedCommits.forEach((c) => {
      commitDetails += formatCommit(c) + "\n";
    });
  }

  const ticketList = Object.keys(ticketCommits);

  return `You are a helpful assistant that summarizes daily development work for stand-up meetings.
Your summaries should be ORGANIZED BY JIRA TICKET and provide MEANINGFUL CODE-LEVEL INSIGHTS.

Given the following commits from yesterday, create a Jira-ticket-focused summary suitable for a daily stand-up meeting.

Commits grouped by ticket:
${commitDetails}

IMPORTANT: 
- Structure your response around Jira tickets
- Analyze the code diffs to understand what was actually implemented
- Don't just repeat commit messages - describe the actual changes
- Each ticket should have its own summary describing what was accomplished

Please provide your response in the following JSON format:
{
  "summary": "A 1-2 sentence high-level overview mentioning the main tickets worked on",
  "tickets": [
    ${ticketList
      .map(
        (t) => `{
      "ticketId": "${t}",
      "summary": "What was accomplished for this ticket (based on code analysis)",
      "bulletPoints": ["Specific implementation 1", "Specific implementation 2"],
      "codeInsights": ["Technical insight about the changes"]
    }`
      )
      .join(",\n    ")}
  ],
  "untracked": ["Any work not associated with a ticket"],
  "bulletPoints": ["Legacy format - overall bullet points"],
  "highlights": ["Key achievement or notable item - mention ticket IDs"]
}

Guidelines:
- Lead with ticket IDs in your summary
- Each ticket summary should explain the business value or feature impact
- Keep bullet points concise and action-oriented
- Use past tense
- Highlight which tickets are complete vs in-progress if discernible`;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  prompt: string,
  apiKey: string
): Promise<SummaryResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes development work for stand-up meetings. Analyze code changes deeply to provide meaningful insights, not just commit message summaries. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000, // Increased for more detailed summaries
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenAI API request failed");
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || "",
      bulletPoints: parsed.bulletPoints || [],
      highlights: parsed.highlights || [],
      tickets: parsed.tickets || [],
      untracked: parsed.untracked || [],
    };
  } catch {
    return {
      summary: content,
      bulletPoints: [],
      highlights: [],
      tickets: [],
      untracked: [],
    };
  }
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  prompt: string,
  apiKey: string
): Promise<SummaryResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000, // Increased for more detailed summaries
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Anthropic API request failed");
  }

  const data = await response.json();
  const content = data.content[0]?.text;

  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || "",
        bulletPoints: parsed.bulletPoints || [],
        highlights: parsed.highlights || [],
        tickets: parsed.tickets || [],
        untracked: parsed.untracked || [],
      };
    }
    return {
      summary: content,
      bulletPoints: [],
      highlights: [],
      tickets: [],
      untracked: [],
    };
  } catch {
    return {
      summary: content,
      bulletPoints: [],
      highlights: [],
      tickets: [],
      untracked: [],
    };
  }
}

/**
 * Call Google Gemini API
 */
async function callGoogle(
  prompt: string,
  apiKey: string
): Promise<SummaryResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000, // Increased for more detailed summaries
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Google Gemini API request failed");
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  try {
    // Try to extract JSON from the response (may be wrapped in markdown code blocks)
    let jsonContent = content;

    // Remove markdown code block markers if present
    if (jsonContent) {
      jsonContent = jsonContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    // Try to find JSON object in the response
    const jsonMatch = jsonContent?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || "Summary generated successfully.",
        bulletPoints: Array.isArray(parsed.bulletPoints)
          ? parsed.bulletPoints
          : [],
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
        untracked: Array.isArray(parsed.untracked) ? parsed.untracked : [],
      };
    }

    const finalParsed = JSON.parse(jsonContent);
    return {
      summary: finalParsed.summary || "",
      bulletPoints: finalParsed.bulletPoints || [],
      highlights: finalParsed.highlights || [],
      tickets: finalParsed.tickets || [],
      untracked: finalParsed.untracked || [],
    };
  } catch {
    // If parsing fails, try to extract meaningful content
    return {
      summary: content?.substring(0, 500) || "Unable to generate summary",
      bulletPoints: [],
      highlights: [],
      tickets: [],
      untracked: [],
    };
  }
}

/**
 * Generate a summary of commits using the specified LLM provider
 * Now supports ticket groups with code diffs for deeper analysis
 */
export async function generateSummary(
  commits: (FlattenedCommit | CommitWithDetails)[],
  provider: LLMProvider,
  apiKey: string,
  ticketGroups?: TicketGroup[]
): Promise<SummaryResult> {
  if (!apiKey) {
    throw new Error(
      `No API key configured for ${provider}. Please add your API key in settings.`
    );
  }

  if (commits.length === 0) {
    return {
      summary: "No commits found for the previous working day.",
      bulletPoints: [],
      highlights: [],
      tickets: [],
      untracked: [],
    };
  }

  // Convert to flattened format if needed
  const flattenedCommits: FlattenedCommit[] = commits.map((c) => {
    if ("commit" in c && c.commit?.message) {
      return {
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author.name,
        authorEmail: c.commit.author.email,
        date: c.commit.author.date,
        url: c.html_url,
        repoFullName: c.repoFullName,
        additions: c.additions,
        deletions: c.deletions,
        filesChanged: c.filesChanged,
        branchName: c.branchName,
      };
    }
    return c as FlattenedCommit;
  });

  const prompt = buildPromptWithDiffs(flattenedCommits, ticketGroups);

  switch (provider) {
    case "openai":
      return callOpenAI(prompt, apiKey);
    case "anthropic":
      return callAnthropic(prompt, apiKey);
    case "google":
      return callGoogle(prompt, apiKey);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Calculate complexity metrics for commits
 */
export interface ComplexityMetrics {
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  totalFilesChanged: number;
  level: "simple" | "moderate" | "complex" | "major";
  score: number;
}

export function calculateComplexity(
  commits: CommitWithDetails[]
): ComplexityMetrics {
  const totalCommits = commits.length;
  const totalAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);
  const totalFilesChanged = commits.reduce((sum, c) => sum + c.filesChanged, 0);

  // Calculate complexity score
  const score =
    totalCommits * 2 +
    totalAdditions / 50 +
    totalDeletions / 100 +
    totalFilesChanged;

  let level: ComplexityMetrics["level"];
  if (score < 5) {
    level = "simple";
  } else if (score < 15) {
    level = "moderate";
  } else if (score < 30) {
    level = "complex";
  } else {
    level = "major";
  }

  return {
    totalCommits,
    totalAdditions,
    totalDeletions,
    totalFilesChanged,
    level,
    score: Math.round(score),
  };
}
