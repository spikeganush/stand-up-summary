/**
 * Multi-provider LLM client for generating commit summaries
 */

import type { CommitWithDetails } from "./github";
import { extractJiraTickets } from "./jira";
import type { LLMProvider } from "@/stores/settings-store";

export interface SummaryResult {
  summary: string;
  bulletPoints: string[];
  highlights: string[];
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
  const commitDetails = commits
    .map((c) => {
      // Handle both flattened (frontend) and nested (GitHub API) structures
      const message = 'commit' in c && c.commit?.message ? c.commit.message : (c as FlattenedCommit).message;
      const tickets = extractJiraTickets(message);
      return `- Repository: ${c.repoFullName}
  Message: ${message}
  Files changed: ${c.filesChanged}
  Lines added: ${c.additions}
  Lines deleted: ${c.deletions}
  ${tickets.length > 0 ? `Jira tickets: ${tickets.join(", ")}` : ""}`;
    })
    .join("\n\n");

  return `You are a helpful assistant that summarizes daily development work for stand-up meetings.

Given the following commits from yesterday, create a concise summary suitable for a daily stand-up meeting. 
Focus on:
1. What was accomplished (user-facing features, bug fixes, improvements)
2. Any technical work (refactoring, infrastructure, dependencies)
3. Work in progress items

Commits:
${commitDetails}

Please provide your response in the following JSON format:
{
  "summary": "A 1-2 sentence overview of the day's work",
  "bulletPoints": ["Point 1", "Point 2", "Point 3"],
  "highlights": ["Key achievement or notable item"]
}

Keep bullet points concise and action-oriented. Use past tense. Don't include commit hashes or technical jargon unless necessary.`;
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
    return JSON.parse(content);
  } catch {
    return {
      summary: content,
      bulletPoints: [],
      highlights: [],
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
      return JSON.parse(jsonMatch[0]);
    }
    return {
      summary: content,
      bulletPoints: [],
      highlights: [],
    };
  } catch {
    return {
      summary: content,
      bulletPoints: [],
      highlights: [],
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
    throw new Error(
      error.error?.message || "Google Gemini API request failed"
    );
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  try {
    // Try to extract JSON from the response (may be wrapped in markdown code blocks)
    let jsonContent = content;
    
    // Remove markdown code block markers if present
    if (jsonContent) {
      jsonContent = jsonContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    }
    
    // Try to find JSON object in the response
    const jsonMatch = jsonContent?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || "Summary generated successfully.",
        bulletPoints: Array.isArray(parsed.bulletPoints) ? parsed.bulletPoints : [],
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      };
    }
    
    return JSON.parse(jsonContent);
  } catch {
    // If parsing fails, try to extract meaningful content
    return {
      summary: content?.substring(0, 500) || "Unable to generate summary",
      bulletPoints: [],
      highlights: [],
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
    totalCommits * 2 + totalAdditions / 50 + totalDeletions / 100 + totalFilesChanged;

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

