/**
 * Multi-provider LLM client for generating commit summaries
 */

import type { CommitWithDetails } from "./github";
import { extractJiraTickets } from "./jira";
import type { LLMProvider } from "@/stores/settings-store";

export interface TicketSummary {
  ticketId: string;
  summary: string;
  bulletPoints: string[];
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
}

/**
 * Build a prompt for the LLM to summarize commits
 * Accepts either flattened commits (from frontend) or nested commits (from GitHub API)
 */
function buildPrompt(commits: (FlattenedCommit | CommitWithDetails)[]): string {
  // Group commits by Jira ticket
  const ticketCommits: Record<string, typeof commits> = {};
  const untrackedCommits: typeof commits = [];

  commits.forEach((c) => {
    const message =
      "commit" in c && c.commit?.message
        ? c.commit.message
        : (c as FlattenedCommit).message;
    const tickets = extractJiraTickets(message);

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

  const formatCommit = (c: FlattenedCommit | CommitWithDetails) => {
    const message =
      "commit" in c && c.commit?.message
        ? c.commit.message
        : (c as FlattenedCommit).message;
    return `  - ${message} (${c.filesChanged} files, +${c.additions}/-${c.deletions})`;
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
Your summaries should be ORGANIZED BY JIRA TICKET - this is the most important structure for stand-ups.

Given the following commits from yesterday, create a Jira-ticket-focused summary suitable for a daily stand-up meeting.

Commits grouped by ticket:
${commitDetails}

IMPORTANT: Structure your response around Jira tickets. Each ticket should have its own summary describing what was accomplished for that ticket.

Please provide your response in the following JSON format:
{
  "summary": "A 1-2 sentence high-level overview mentioning the main tickets worked on",
  "tickets": [
    ${ticketList
      .map(
        (t) => `{
      "ticketId": "${t}",
      "summary": "What was accomplished for this ticket",
      "bulletPoints": ["Specific change 1", "Specific change 2"]
    }`
      )
      .join(",\n    ")}
  ],
  "untracked": ["Any work not associated with a ticket"],
  "bulletPoints": ["Legacy format - overall bullet points"],
  "highlights": ["Key achievement or notable item - mention ticket IDs"]
}

Guidelines:
- Lead with ticket IDs in your summary (e.g., "Worked on SC-1291 and SC-1319...")
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
            "You are a helpful assistant that summarizes development work for stand-up meetings. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
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
      max_tokens: 1000,
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
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
          maxOutputTokens: 1000,
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
 */
export async function generateSummary(
  commits: (FlattenedCommit | CommitWithDetails)[],
  provider: LLMProvider,
  apiKey: string
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

  const prompt = buildPrompt(commits);

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
