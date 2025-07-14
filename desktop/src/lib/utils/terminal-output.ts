import { formatTimestamp } from './timestamp';

/**
 * Add timestamp to terminal output line
 * @param line - Terminal output line
 * @param timestamp - Optional timestamp (defaults to current time)
 * @param format - Timestamp format options
 * @returns Line with timestamp prefix
 */
export function addTimestampToLine(
  line: string,
  timestamp?: Date | string,
  format: {
    includeMilliseconds?: boolean;
    separator?: string;
  } = {}
): string {
  const { includeMilliseconds = false, separator = ' | ' } = format;
  
  const date = timestamp instanceof Date ? timestamp : 
    timestamp ? new Date(timestamp) : new Date();
  
  const timeFormat = includeMilliseconds ? 
    date.toISOString().substring(11, 23) : // HH:mm:ss.SSS
    date.toISOString().substring(11, 19);   // HH:mm:ss
  
  return `[${timeFormat}]${separator}${line}`;
}

/**
 * Process terminal output and add timestamps to each line
 * @param output - Raw terminal output
 * @param options - Processing options
 * @returns Processed output with timestamps
 */
export function processTerminalOutput(
  output: string,
  options: {
    addTimestamps?: boolean;
    includeMilliseconds?: boolean;
    preserveAnsi?: boolean;
  } = {}
): string {
  const { 
    addTimestamps = false, 
    includeMilliseconds = false,
    preserveAnsi = true 
  } = options;
  
  if (!addTimestamps) {
    return output;
  }
  
  const lines = output.split('\n');
  const timestamp = new Date();
  
  return lines
    .map(line => {
      // Skip empty lines
      if (!line.trim()) return line;
      
      // Add timestamp to non-empty lines
      return addTimestampToLine(line, timestamp, { includeMilliseconds });
    })
    .join('\n');
}

/**
 * Parse timestamp from terminal output line
 * @param line - Terminal output line with potential timestamp
 * @returns Parsed timestamp and line content, or null if no timestamp found
 */
export function parseTimestampFromLine(line: string): {
  timestamp: Date | null;
  content: string;
} | null {
  // Match common timestamp formats at the beginning of the line
  const patterns = [
    // [HH:mm:ss] format
    /^\[(\d{2}:\d{2}:\d{2})\]\s*\|\s*(.*)$/,
    // [HH:mm:ss.SSS] format
    /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*\|\s*(.*)$/,
    // ISO timestamp format
    /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)\]\s*\|\s*(.*)$/,
    // Unix timestamp format
    /^\[(\d{10,13})\]\s*\|\s*(.*)$/,
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const [, timestampStr, content] = match;
      
      let timestamp: Date | null = null;
      
      // Parse based on format
      if (timestampStr.includes('T')) {
        // ISO format
        timestamp = new Date(timestampStr);
      } else if (/^\d{10,13}$/.test(timestampStr)) {
        // Unix timestamp
        const ts = parseInt(timestampStr, 10);
        timestamp = new Date(ts > 1e10 ? ts : ts * 1000);
      } else {
        // Time only format - use today's date
        const today = new Date();
        const [hours, minutes, secondsAndMs] = timestampStr.split(':');
        const [seconds, milliseconds = '0'] = secondsAndMs.split('.');
        
        today.setHours(parseInt(hours, 10));
        today.setMinutes(parseInt(minutes, 10));
        today.setSeconds(parseInt(seconds, 10));
        today.setMilliseconds(parseInt(milliseconds, 10));
        
        timestamp = today;
      }
      
      if (timestamp && !isNaN(timestamp.getTime())) {
        return { timestamp, content };
      }
    }
  }
  
  return null;
}