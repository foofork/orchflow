// Timestamp utilities for parsing and formatting terminal timestamps

/**
 * Parse an ISO timestamp string into a Date object
 * @param timestamp - ISO formatted timestamp string
 * @returns Date object or null if parsing fails
 */
export function parseTimestamp(timestamp: string | undefined | null): Date | null {
  if (!timestamp) return null;
  
  try {
    const date = new Date(timestamp);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return null;
    }
    return date;
  } catch (error) {
    console.error('Error parsing timestamp:', error, timestamp);
    return null;
  }
}

/**
 * Format a timestamp for display
 * @param timestamp - ISO formatted timestamp string or Date object
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatTimestamp(
  timestamp: string | Date | undefined | null,
  options: {
    includeTime?: boolean;
    relative?: boolean;
    format?: 'short' | 'medium' | 'long';
  } = {}
): string {
  const { includeTime = true, relative = false, format = 'medium' } = options;
  
  const date = timestamp instanceof Date ? timestamp : parseTimestamp(timestamp as string);
  if (!date) return 'Unknown';
  
  if (relative) {
    return formatRelativeTime(date);
  }
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: format === 'short' ? '2-digit' : 'numeric',
    month: format === 'short' ? 'numeric' : format === 'long' ? 'long' : 'short',
    day: 'numeric',
  };
  
  const timeOptions: Intl.DateTimeFormatOptions = includeTime ? {
    hour: '2-digit',
    minute: '2-digit',
    second: format === 'long' ? '2-digit' : undefined,
  } : {};
  
  return date.toLocaleString(undefined, { ...dateOptions, ...timeOptions });
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago")
 * @param date - Date object to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return diffSeconds === 1 ? '1 second ago' : `${diffSeconds} seconds ago`;
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else {
    return formatTimestamp(date, { includeTime: false, format: 'medium' });
  }
}

/**
 * Parse a timestamp from muxd backend response
 * The backend may send timestamps in different formats
 * @param value - Raw timestamp value from backend
 * @returns Parsed Date object or null
 */
export function parseMuxdTimestamp(value: unknown): Date | null {
  if (!value) return null;
  
  // Handle different timestamp formats from muxd
  if (typeof value === 'string') {
    // Check if it looks like a Unix timestamp string first (all digits)
    if (/^\d+$/.test(value)) {
      const numValue = parseInt(value, 10);
      const timestamp = numValue > 1e10 ? numValue : numValue * 1000;
      return new Date(timestamp);
    }
    
    // Otherwise try to parse as ISO string
    return parseTimestamp(value);
  } else if (typeof value === 'number') {
    // Unix timestamp (seconds or milliseconds)
    const timestamp = value > 1e10 ? value : value * 1000;
    return new Date(timestamp);
  } else if (value instanceof Date) {
    return value;
  } else if (typeof value === 'object' && value !== null) {
    // Handle object with timestamp properties (e.g., { secs: number, nanos: number })
    const obj = value as any;
    if ('secs' in obj || 'secs_since_epoch' in obj) {
      const secs = obj.secs || obj.secs_since_epoch || 0;
      const nanos = obj.nanos || obj.nanos_since_epoch || 0;
      // Convert to milliseconds
      const ms = secs * 1000 + Math.floor(nanos / 1_000_000);
      return new Date(ms);
    }
  }
  
  console.warn('Unknown timestamp format:', value);
  return null;
}