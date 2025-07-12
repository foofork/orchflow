/**
 * Timeout utilities for consistent timeout handling across the application
 */

export const TIMEOUT_CONFIG = {
  // API timeouts
  TAURI_API: 15000,        // 15s for Tauri API calls
  WEBSOCKET_CONNECT: 10000, // 10s for WebSocket connections
  FILE_OPERATIONS: 10000,   // 10s for file operations
  
  // UI timeouts
  TERMINAL_POLL: 500,       // 500ms for terminal polling
  UI_ANIMATION: 300,        // 300ms for UI animations
  DEBOUNCE: 300,           // 300ms for input debouncing
  
  // Test timeouts
  TEST_TIMEOUT: 30000,      // 30s for tests
  HOOK_TIMEOUT: 30000,      // 30s for test hooks
  
  // Network timeouts
  HTTP_REQUEST: 15000,      // 15s for HTTP requests
  RETRY_BACKOFF_MAX: 30000, // 30s max backoff for retries
} as const;

/**
 * Wraps a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message for timeout
 * @returns Promise that rejects on timeout
 */
export function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    })
  ]);
}

/**
 * Creates a debounced function that delays invoking func until after delay milliseconds
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T, 
  delay: number = TIMEOUT_CONFIG.DEBOUNCE
): (...args: Parameters<T>) => void {
  let timeoutId: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay) as unknown as number;
  };
}

/**
 * Creates an exponential backoff delay
 * @param attempt - Current attempt number (0-based)
 * @param baseMs - Base delay in milliseconds
 * @param maxMs - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function exponentialBackoff(
  attempt: number, 
  baseMs: number = 1000, 
  maxMs: number = TIMEOUT_CONFIG.RETRY_BACKOFF_MAX
): number {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs);
}

/**
 * Retry a promise with exponential backoff
 * @param fn - Function that returns a promise
 * @param maxRetries - Maximum number of retries
 * @param baseMs - Base delay in milliseconds
 * @returns Promise that resolves or rejects after all retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = exponentialBackoff(attempt, baseMs);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Creates a timeout controller that can be cancelled
 */
export class TimeoutController {
  private timeoutId?: number;
  private readonly timeoutMs: number;
  private readonly errorMessage: string;
  
  constructor(timeoutMs: number, errorMessage: string = 'Operation timed out') {
    this.timeoutMs = timeoutMs;
    this.errorMessage = errorMessage;
  }
  
  start(): Promise<never> {
    return new Promise((_, reject) => {
      this.timeoutId = setTimeout(() => {
        reject(new Error(this.errorMessage));
      }, this.timeoutMs) as unknown as number;
    });
  }
  
  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
  
  wrap<T>(promise: Promise<T>): Promise<T> {
    const timeoutPromise = this.start();
    
    return Promise.race([
      promise.finally(() => this.cancel()),
      timeoutPromise
    ]);
  }
}

/**
 * Sleep utility for async operations
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}