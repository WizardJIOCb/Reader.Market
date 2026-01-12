import { formatDistanceToNow, format, isToday } from 'date-fns';
import type { Locale } from 'date-fns';

/**
 * Safely converts any timestamp input to a Date object
 * Handles ISO strings, timestamps, and Date objects
 */
export function ensureDate(timestamp: string | Date | number): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', timestamp);
      return new Date(); // Return current date as fallback
    }
    return date;
  }
  
  console.error('Invalid timestamp type:', typeof timestamp);
  return new Date(); // Return current date as fallback
}

/**
 * Display relative time (e.g., "2 hours ago", "just now")
 * Automatically converts to user's local timezone
 */
export function formatRelativeTime(
  timestamp: string | Date | number,
  locale: Locale
): string {
  const date = ensureDate(timestamp);
  return formatDistanceToNow(date, { addSuffix: true, locale });
}

/**
 * Display full date and time in user's local timezone
 * Format: "dd.MM.yyyy HH:mm"
 */
export function formatAbsoluteDateTime(
  timestamp: string | Date | number,
  locale: Locale
): string {
  const date = ensureDate(timestamp);
  return format(date, 'dd.MM.yyyy HH:mm', { locale });
}

/**
 * Display date only in user's local timezone
 * Format: "dd.MM.yyyy"
 */
export function formatAbsoluteDate(
  timestamp: string | Date | number,
  locale: Locale
): string {
  const date = ensureDate(timestamp);
  return format(date, 'dd.MM.yyyy', { locale });
}

/**
 * Smart formatting for chat messages
 * - If today: shows only time "HH:mm"
 * - If older: shows date + time "dd.MM.yyyy HH:mm"
 * Automatically converts to user's local timezone
 */
export function formatMessageTimestamp(
  timestamp: string | Date | number,
  locale: Locale
): string {
  const date = ensureDate(timestamp);
  
  if (isToday(date)) {
    return format(date, 'HH:mm', { locale });
  }
  
  return format(date, 'dd.MM.yyyy HH:mm', { locale });
}
