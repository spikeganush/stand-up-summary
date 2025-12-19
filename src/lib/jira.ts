/**
 * Jira ticket extraction and URL generation utilities
 */

// Default Jira base URL - can be customized via environment variable
const JIRA_BASE_URL =
  process.env.NEXT_PUBLIC_JIRA_BASE_URL || "https://mastt.atlassian.net/browse";

/**
 * Regex pattern to match Jira ticket IDs
 * Matches patterns like: ABC-123, PROJ-1, SC-1319
 */
const JIRA_TICKET_REGEX = /[A-Z][A-Z0-9]+-\d+/g;

/**
 * Extract all Jira ticket IDs from a given text
 * @param text - The text to search for ticket IDs (branch name, PR title, commit message)
 * @returns Array of unique ticket IDs found
 */
export function extractJiraTickets(text: string): string[] {
  if (!text) return [];

  const matches = text.match(JIRA_TICKET_REGEX);
  if (!matches) return [];

  // Return unique tickets only
  return [...new Set(matches)];
}

/**
 * Generate a Jira ticket URL
 * @param ticketId - The ticket ID (e.g., "SC-1319")
 * @returns Full URL to the Jira ticket
 */
export function getJiraUrl(ticketId: string): string {
  return `${JIRA_BASE_URL}/${ticketId}`;
}

/**
 * Extract tickets and generate URLs from text
 * @param text - The text to search for ticket IDs
 * @returns Array of objects with ticketId and url
 */
export function extractJiraTicketsWithUrls(
  text: string
): { ticketId: string; url: string }[] {
  const tickets = extractJiraTickets(text);
  return tickets.map((ticketId) => ({
    ticketId,
    url: getJiraUrl(ticketId),
  }));
}

/**
 * Extract tickets from multiple sources (branch, PR title, commit messages)
 * @param sources - Object containing various text sources
 * @returns Array of unique tickets with their URLs
 */
export function extractAllJiraTickets(sources: {
  branchName?: string;
  prTitle?: string;
  commitMessages?: string[];
}): { ticketId: string; url: string }[] {
  const allTexts: string[] = [];

  if (sources.branchName) {
    allTexts.push(sources.branchName);
  }

  if (sources.prTitle) {
    allTexts.push(sources.prTitle);
  }

  if (sources.commitMessages) {
    allTexts.push(...sources.commitMessages);
  }

  const combinedText = allTexts.join(" ");
  return extractJiraTicketsWithUrls(combinedText);
}

/**
 * Check if a string contains a Jira ticket
 * @param text - The text to check
 * @returns Boolean indicating if a ticket was found
 */
export function containsJiraTicket(text: string): boolean {
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
