import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  parseTimestamp, 
  formatTimestamp, 
  formatRelativeTime,
  parseMuxdTimestamp 
} from '../timestamp';

describe('timestamp utilities', () => {
  describe('parseTimestamp', () => {
    it('should parse valid ISO timestamp', () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      const result = parseTimestamp(timestamp);
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(timestamp);
    });
    
    it('should return null for invalid timestamp', () => {
      expect(parseTimestamp('invalid')).toBeNull();
      expect(parseTimestamp('')).toBeNull();
      expect(parseTimestamp(null)).toBeNull();
      expect(parseTimestamp(undefined)).toBeNull();
    });
    
    it('should handle various date formats', () => {
      const formats = [
        '2024-01-15T10:30:00Z',
        '2024-01-15T10:30:00.000Z',
        '2024-01-15T10:30:00+00:00',
        '2024-01-15T10:30:00-05:00',
      ];
      
      formats.forEach(format => {
        const result = parseTimestamp(format);
        expect(result).toBeInstanceOf(Date);
        expect(result?.getTime()).not.toBeNaN();
      });
    });
  });
  
  describe('formatTimestamp', () => {
    const mockDate = new Date('2024-01-15T10:30:00.000Z');
    
    it('should format date with time by default', () => {
      const result = formatTimestamp(mockDate);
      expect(result).toMatch(/\d/); // Should contain numbers
      expect(result).not.toBe('Unknown');
    });
    
    it('should format without time when specified', () => {
      const result = formatTimestamp(mockDate, { includeTime: false });
      expect(result).toMatch(/\d/);
      expect(result).not.toMatch(/:/); // No time separator
    });
    
    it('should handle string timestamps', () => {
      const result = formatTimestamp('2024-01-15T10:30:00.000Z');
      expect(result).not.toBe('Unknown');
    });
    
    it('should return Unknown for invalid timestamps', () => {
      expect(formatTimestamp(null)).toBe('Unknown');
      expect(formatTimestamp(undefined)).toBe('Unknown');
      expect(formatTimestamp('invalid')).toBe('Unknown');
    });
  });
  
  describe('formatRelativeTime', () => {
    let mockNow: Date;
    
    beforeEach(() => {
      mockNow = new Date('2024-01-15T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockNow);
    });
    
    afterEach(() => {
      vi.useRealTimers();
    });
    
    it('should format seconds ago', () => {
      const date = new Date(mockNow.getTime() - 30 * 1000);
      expect(formatRelativeTime(date)).toBe('30 seconds ago');
      
      const date1 = new Date(mockNow.getTime() - 1000);
      expect(formatRelativeTime(date1)).toBe('1 second ago');
    });
    
    it('should format minutes ago', () => {
      const date = new Date(mockNow.getTime() - 5 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('5 minutes ago');
      
      const date1 = new Date(mockNow.getTime() - 60 * 1000);
      expect(formatRelativeTime(date1)).toBe('1 minute ago');
    });
    
    it('should format hours ago', () => {
      const date = new Date(mockNow.getTime() - 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('3 hours ago');
      
      const date1 = new Date(mockNow.getTime() - 60 * 60 * 1000);
      expect(formatRelativeTime(date1)).toBe('1 hour ago');
    });
    
    it('should format days ago', () => {
      const date = new Date(mockNow.getTime() - 2 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('2 days ago');
      
      const date1 = new Date(mockNow.getTime() - 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date1)).toBe('1 day ago');
    });
    
    it('should use absolute format for dates older than a week', () => {
      const date = new Date(mockNow.getTime() - 8 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(date);
      expect(result).not.toMatch(/ago/);
      expect(result).toMatch(/\d/);
    });
  });
  
  describe('parseMuxdTimestamp', () => {
    it('should parse string timestamps', () => {
      const result = parseMuxdTimestamp('2024-01-15T10:30:00.000Z');
      expect(result).toBeInstanceOf(Date);
    });
    
    it('should parse unix timestamp strings', () => {
      const result = parseMuxdTimestamp('1705318200');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(1705318200 * 1000);
    });
    
    it('should parse unix timestamps in seconds', () => {
      const unixSeconds = 1705318200; // 2024-01-15T10:30:00.000Z
      const result = parseMuxdTimestamp(unixSeconds);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(unixSeconds * 1000);
    });
    
    it('should parse unix timestamps in milliseconds', () => {
      const unixMs = 1705318200000; // 2024-01-15T10:30:00.000Z
      const result = parseMuxdTimestamp(unixMs);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(unixMs);
    });
    
    it('should handle Date objects', () => {
      const date = new Date();
      const result = parseMuxdTimestamp(date);
      expect(result).toBe(date);
    });
    
    it('should parse object with secs and nanos', () => {
      const result = parseMuxdTimestamp({ secs: 1705318200, nanos: 500_000_000 });
      expect(result).toBeInstanceOf(Date);
      // secs * 1000 + nanos / 1_000_000 = 1705318200000 + 500
      expect(result?.getTime()).toBe(1705318200500);
    });
    
    it('should parse object with secs_since_epoch', () => {
      const result = parseMuxdTimestamp({ secs_since_epoch: 1705318200, nanos_since_epoch: 0 });
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(1705318200000);
    });
    
    it('should return null for invalid values', () => {
      expect(parseMuxdTimestamp(null)).toBeNull();
      expect(parseMuxdTimestamp(undefined)).toBeNull();
      expect(parseMuxdTimestamp('')).toBeNull();
      expect(parseMuxdTimestamp('not-a-number')).toBeNull();
      expect(parseMuxdTimestamp({})).toBeNull();
      expect(parseMuxdTimestamp([])).toBeNull();
    });
    
    it('should warn on unknown formats', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      parseMuxdTimestamp({ weird: 'object' });
      
      expect(warnSpy).toHaveBeenCalledWith('Unknown timestamp format:', { weird: 'object' });
      warnSpy.mockRestore();
    });
  });
});