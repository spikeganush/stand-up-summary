import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the previous working day.
 * - Monday → Friday (go back 3 days)
 * - Sunday → Friday (go back 2 days)
 * - Saturday → Friday (go back 1 day)
 * - Other days → Yesterday (go back 1 day)
 */
export function getPreviousWorkingDay(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();

  let daysToSubtract: number;
  if (dayOfWeek === 1) {
    // Monday
    daysToSubtract = 3;
  } else if (dayOfWeek === 0) {
    // Sunday
    daysToSubtract = 2;
  } else if (dayOfWeek === 6) {
    // Saturday
    daysToSubtract = 1;
  } else {
    daysToSubtract = 1;
  }

  const previousDay = new Date(today);
  previousDay.setDate(today.getDate() - daysToSubtract);
  // Set to start of day
  previousDay.setHours(0, 0, 0, 0);
  return previousDay;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date for GitHub API (ISO 8601)
 */
export function formatDateForGitHub(date: Date): string {
  return date.toISOString();
}

/**
 * Get the date range for fetching commits (defaults to previous working day)
 */
export function getCommitDateRange(): { since: string; until: string } {
  const previousDay = getPreviousWorkingDay();
  return getCommitDateRangeForDate(previousDay);
}

/**
 * Get the date range for fetching commits for a specific date
 */
export function getCommitDateRangeForDate(date: Date): { since: string; until: string } {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    since: formatDateForGitHub(startOfDay),
    until: formatDateForGitHub(endOfDay),
  };
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return formatDate(date);
}
