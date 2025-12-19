/**
 * Jira ticket extraction and URL generation utilities
 */

// Default Jira base URL - can be customized via environment variable or settings
const DEFAULT_JIRA_BASE_URL =
  process.env.NEXT_PUBLIC_JIRA_BASE_URL || "https://jira.atlassian.net/browse";

/**
 * Regex pattern to match Jira ticket IDs
 * Matches patterns like: ABC-123, PROJ-1, SC-1319
 */
const JIRA_TICKET_REGEX = /[A-Z][A-Z0-9]+-\d+/g;

/**
 * Regex pattern to extract ticket from branch names
 * Matches patterns like:
 * - feature/SC-1234
 * - bugfix/SC-1234-fix-something
 * - SC-1234-description
 * - hotfix/PROJ-123-urgent-fix
 */
const BRANCH_TICKET_REGEX = /(?:^|\/)?([A-Z][A-Z0-9]+-\d+)(?:-|\/|$)/i;

/**
 * Extract ticket ID specifically from a branch name
 * Handles common branch naming patterns:
 * - feature/SC-1234
 * - feature/SC-1234-description
 * - bugfix/SC-1234
 * - SC-1234-some-feature
 * @param branchName - The branch name to parse
 * @returns The ticket ID if found, or null
 */
export function extractTicketFromBranch(branchName: string): string | null {
  if (!branchName) return null;

  // First try the branch-specific pattern
  const branchMatch = branchName.match(BRANCH_TICKET_REGEX);
  if (branchMatch && branchMatch[1]) {
    return branchMatch[1].toUpperCase();
  }

  // Fallback to general pattern
  const tickets = extractJiraTickets(branchName);
  return tickets.length > 0 ? tickets[0] : null;
}

/**
 * Extract all Jira ticket IDs from a given text
 * @param text - The text to search for ticket IDs (branch name, PR title, commit message)
 * @returns Array of unique ticket IDs found
 */
export function extractJiraTickets(text: string): string[] {
  if (!text) return [];

  const matches = text.match(JIRA_TICKET_REGEX);
  if (!matches) return [];

  // Return unique tickets only (uppercase)
  return [...new Set(matches.map((t) => t.toUpperCase()))];
}

/**
 * Generate a Jira ticket URL
 * @param ticketId - The ticket ID (e.g., "SC-1319")
 * @param baseUrl - Optional custom base URL (defaults to env var or fallback)
 * @returns Full URL to the Jira ticket
 */
export function getJiraUrl(ticketId: string, baseUrl?: string): string {
  const base = baseUrl || DEFAULT_JIRA_BASE_URL;
  // Ensure no trailing slash on base URL
  const cleanBase = base.replace(/\/$/, "");
  return `${cleanBase}/${ticketId}`;
}

/**
 * Extract tickets and generate URLs from text
 * @param text - The text to search for ticket IDs
 * @param baseUrl - Optional custom Jira base URL
 * @returns Array of objects with ticketId and url
 */
export function extractJiraTicketsWithUrls(
  text: string,
  baseUrl?: string
): { ticketId: string; url: string }[] {
  const tickets = extractJiraTickets(text);
  return tickets.map((ticketId) => ({
    ticketId,
    url: getJiraUrl(ticketId, baseUrl),
  }));
}

/**
 * Extract tickets from multiple sources (branch, PR title, commit messages)
 * Branch names are given priority for ticket extraction
 * @param sources - Object containing various text sources
 * @param baseUrl - Optional custom Jira base URL
 * @returns Array of unique tickets with their URLs
 */
export function extractAllJiraTickets(
  sources: {
    branchName?: string;
    prTitle?: string;
    commitMessages?: string[];
  },
  baseUrl?: string
): { ticketId: string; url: string }[] {
  const ticketSet = new Set<string>();

  // Priority 1: Branch name (most reliable source)
  if (sources.branchName) {
    const branchTicket = extractTicketFromBranch(sources.branchName);
    if (branchTicket) {
      ticketSet.add(branchTicket);
    }
    // Also check for any other tickets in branch name
    extractJiraTickets(sources.branchName).forEach((t) => ticketSet.add(t));
  }

  // Priority 2: PR title
  if (sources.prTitle) {
    extractJiraTickets(sources.prTitle).forEach((t) => ticketSet.add(t));
  }

  // Priority 3: Commit messages
  if (sources.commitMessages) {
    sources.commitMessages.forEach((msg) => {
      extractJiraTickets(msg).forEach((t) => ticketSet.add(t));
    });
  }

  return Array.from(ticketSet).map((ticketId) => ({
    ticketId,
    url: getJiraUrl(ticketId, baseUrl),
  }));
}

/**
 * Check if a string contains a Jira ticket
 * @param text - The text to check
 * @returns Boolean indicating if a ticket was found
 */
export function containsJiraTicket(text: string): boolean {
  if (!text) return false;
  // Reset regex state
  JIRA_TICKET_REGEX.lastIndex = 0;
  return JIRA_TICKET_REGEX.test(text);
}

/**
 * Format ticket ID for display (ensures uppercase)
 * @param ticketId - The ticket ID to format
 * @returns Formatted ticket ID
 */
export function formatTicketId(ticketId: string): string {
  return ticketId.toUpperCase();
}

/**
 * Check if a branch name looks like a feature branch with a ticket
 * @param branchName - The branch name to check
 * @returns Boolean indicating if this is a ticket-related branch
 */
export function isTicketBranch(branchName: string): boolean {
  if (!branchName) return false;
  const prefixes = [
    "feature/",
    "bugfix/",
    "hotfix/",
    "fix/",
    "feat/",
    "task/",
    "story/",
    "issue/",
  ];
  const lowerBranch = branchName.toLowerCase();
  const hasPrefix = prefixes.some((p) => lowerBranch.startsWith(p));
  const hasTicket = !!extractTicketFromBranch(branchName);
  return hasPrefix || hasTicket;
}
