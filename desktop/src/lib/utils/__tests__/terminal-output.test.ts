import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  addTimestampToLine, 
  processTerminalOutput,
  parseTimestampFromLine 
} from '../terminal-output';

describe('terminal-output utilities', () => {
  let mockDate: Date;
  
  beforeEach(() => {
    mockDate = new Date('2024-01-15T10:30:45.123Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('addTimestampToLine', () => {
    it('should add timestamp to line with default format', () => {
      const result = addTimestampToLine('Hello world');
      expect(result).toBe('[10:30:45] | Hello world');
    });
    
    it('should add timestamp with milliseconds', () => {
      const result = addTimestampToLine('Hello world', undefined, { 
        includeMilliseconds: true 
      });
      expect(result).toBe('[10:30:45.123] | Hello world');
    });
    
    it('should use custom separator', () => {
      const result = addTimestampToLine('Hello world', undefined, { 
        separator: ' - ' 
      });
      expect(result).toBe('[10:30:45] - Hello world');
    });
    
    it('should use provided timestamp', () => {
      const customDate = new Date('2024-01-15T15:45:30.000Z');
      const result = addTimestampToLine('Hello world', customDate);
      expect(result).toBe('[15:45:30] | Hello world');
    });
  });
  
  describe('processTerminalOutput', () => {
    it('should return output unchanged when addTimestamps is false', () => {
      const output = 'Line 1\nLine 2\nLine 3';
      const result = processTerminalOutput(output);
      expect(result).toBe(output);
    });
    
    it('should add timestamps to each non-empty line', () => {
      const output = 'Line 1\nLine 2\n\nLine 3';
      const result = processTerminalOutput(output, { addTimestamps: true });
      
      const lines = result.split('\n');
      expect(lines[0]).toBe('[10:30:45] | Line 1');
      expect(lines[1]).toBe('[10:30:45] | Line 2');
      expect(lines[2]).toBe(''); // Empty line preserved
      expect(lines[3]).toBe('[10:30:45] | Line 3');
    });
    
    it('should add timestamps with milliseconds when specified', () => {
      const output = 'Command output';
      const result = processTerminalOutput(output, { 
        addTimestamps: true,
        includeMilliseconds: true 
      });
      
      expect(result).toBe('[10:30:45.123] | Command output');
    });
  });
  
  describe('parseTimestampFromLine', () => {
    it('should parse HH:mm:ss format', () => {
      const line = '[10:30:45] | Command executed';
      const result = parseTimestampFromLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.content).toBe('Command executed');
      expect(result?.timestamp?.getHours()).toBe(10);
      expect(result?.timestamp?.getMinutes()).toBe(30);
      expect(result?.timestamp?.getSeconds()).toBe(45);
    });
    
    it('should parse HH:mm:ss.SSS format', () => {
      const line = '[10:30:45.123] | Command executed';
      const result = parseTimestampFromLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.content).toBe('Command executed');
      expect(result?.timestamp?.getMilliseconds()).toBe(123);
    });
    
    it('should parse ISO timestamp format', () => {
      const line = '[2024-01-15T10:30:45.123Z] | Command executed';
      const result = parseTimestampFromLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.content).toBe('Command executed');
      expect(result?.timestamp?.toISOString()).toBe('2024-01-15T10:30:45.123Z');
    });
    
    it('should parse Unix timestamp format', () => {
      const unixTime = 1705318245000; // 2024-01-15T10:30:45.000Z
      const line = `[${unixTime}] | Command executed`;
      const result = parseTimestampFromLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.content).toBe('Command executed');
      expect(result?.timestamp?.getTime()).toBe(unixTime);
    });
    
    it('should parse Unix timestamp in seconds', () => {
      const unixTime = 1705318245; // 2024-01-15T10:30:45.000Z
      const line = `[${unixTime}] | Command executed`;
      const result = parseTimestampFromLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.content).toBe('Command executed');
      expect(result?.timestamp?.getTime()).toBe(unixTime * 1000);
    });
    
    it('should return null for lines without timestamps', () => {
      const lines = [
        'Regular output',
        'Output without timestamp',
        '[] | Empty timestamp',
        '[invalid] | Invalid timestamp'
      ];
      
      lines.forEach(line => {
        const result = parseTimestampFromLine(line);
        expect(result).toBeNull();
      });
    });
  });
});