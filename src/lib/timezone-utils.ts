/**
 * Timezone utilities using date-fns-tz for consistent timezone handling
 */

import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Get the browser's detected timezone
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC'; // Fallback
  }
}

/**
 * Get list of all IANA timezones supported by the browser
 */
export function getSupportedTimezones(): string[] {
  try {
    // @ts-ignore - Intl.supportedValuesOf may not be in all TypeScript versions
    if (typeof Intl.supportedValuesOf === 'function') {
      // @ts-ignore
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // Fallback to common timezones if API not available
  }
  
  // Fallback list of common timezones
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];
}

/**
 * Parse an ISO date string (YYYY-MM-DD) as a date in the specified timezone
 * Returns a Date object representing midnight in that timezone
 */
export function parseISODateInTimezone(isoDateString: string, timezone: string): Date {
  const dateOnly = isoDateString.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);
  
  // Create date at midnight in the target timezone
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
  return fromZonedTime(dateStr, timezone);
}

/**
 * Format a Date object to YYYY-MM-DD in the specified timezone
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/**
 * Format a Date object to a display string in the specified timezone
 */
export function formatDateTimeInTimezone(
  date: Date,
  timezone: string,
  formatStr: string = 'PPP p'
): string {
  return formatInTimeZone(date, timezone, formatStr);
}

/**
 * Convert a Date to the specified timezone
 */
export function toTimezone(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone);
}

/**
 * Get current date/time in the specified timezone
 */
export function nowInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Get midnight today in the specified timezone
 */
export function todayInTimezone(timezone: string): Date {
  const now = toZonedTime(new Date(), timezone);
  const dateStr = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  return parseISODateInTimezone(dateStr, timezone);
}

/**
 * Get timezone display name (e.g., "Eastern Standard Time (EST)")
 */
export function getTimezoneDisplayName(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'long',
    });
    const parts = formatter.formatToParts(now);
    const timeZoneName = parts.find(p => p.type === 'timeZoneName')?.value || timezone;
    
    // Also get short name
    const shortFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const shortParts = shortFormatter.formatToParts(now);
    const shortName = shortParts.find(p => p.type === 'timeZoneName')?.value || '';
    
    if (shortName && shortName !== timezone) {
      return `${timezone} (${shortName})`;
    }
    return timezone;
  } catch {
    return timezone;
  }
}

/**
 * Get timezone offset string (e.g., "GMT-5")
 */
export function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    return parts.find(p => p.type === 'timeZoneName')?.value || '';
  } catch {
    return '';
  }
}

/**
 * Check if a date is before today in the specified timezone
 */
export function isBeforeTodayInTimezone(date: Date, timezone: string): boolean {
  const today = todayInTimezone(timezone);
  const checkDate = toZonedTime(date, timezone);
  
  // Compare YYYY-MM-DD strings for accurate date-only comparison
  const todayStr = formatDateInTimezone(today, timezone);
  const checkDateStr = formatDateInTimezone(checkDate, timezone);
  
  return checkDateStr < todayStr;
}

/**
 * Check if a date is today in the specified timezone
 */
export function isTodayInTimezone(date: Date, timezone: string): boolean {
  const today = todayInTimezone(timezone);
  const checkDate = toZonedTime(date, timezone);
  
  // Compare YYYY-MM-DD strings for accurate date-only comparison
  const todayStr = formatDateInTimezone(today, timezone);
  const checkDateStr = formatDateInTimezone(checkDate, timezone);
  
  return checkDateStr === todayStr;
}
