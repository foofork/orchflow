import { EventEmitter } from 'events';
import { EventBus, OrchflowEvents } from './event-bus';

export enum CircuitState {
  CLOSED = 'CLOSED',  // Normal operation
  OPEN = 'OPEN',      // Failing, reject all calls
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;  // Number of failures before opening
  successThreshold: number;  // Number of successes to close from half-open
  timeout: number;          // Time in ms before trying half-open
  resetTimeout: number;     // Time in ms to reset failure count
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private nextAttempt?: Date;
  private resetTimer?: NodeJS.Timeout;
  private halfOpenTimer?: NodeJS.Timeout;
  
  // Statistics
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  
  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = config;
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalCalls++;
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttempt && new Date() < this.nextAttempt) {
        throw new Error(`Circuit breaker is open`);
      }
      // Try half-open
      this.transitionTo(CircuitState.HALF_OPEN);
    }
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), this.config.timeout);
    });
    
    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccess = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failures = 0; // Reset failure count on success
    }
    
    this.emit('success');
    this.scheduleReset();
  }
  
  private onFailure(error: any): void {
    this.totalFailures++;
    this.lastFailure = new Date();
    this.failures++;
    
    EventBus.emit(OrchflowEvents.SYSTEM_ERROR, {
      error: `Circuit breaker failure: ${this.config.name} - ${error.message}`,
    });
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
    
    this.emit('failure', error);
  }
  
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    
    console.log(`Circuit breaker ${this.config.name}: ${oldState} -> ${newState}`);
    
    switch (newState) {
      case CircuitState.OPEN:
        this.failures = 0;
        this.successes = 0;
        this.nextAttempt = new Date(Date.now() + this.config.timeout);
        this.scheduleHalfOpen();
        break;
        
      case CircuitState.HALF_OPEN:
        this.failures = 0;
        this.successes = 0;
        this.clearTimers();
        break;
        
      case CircuitState.CLOSED:
        this.failures = 0;
        this.successes = 0;
        this.nextAttempt = undefined;
        this.clearTimers();
        break;
    }
    
    this.emit('stateChange', { from: oldState, to: newState });
  }
  
  private scheduleReset(): void {
    this.clearResetTimer();
    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitState.CLOSED && this.failures > 0) {
        this.failures = 0;
        this.emit('reset');
      }
    }, this.config.resetTimeout);
  }
  
  private scheduleHalfOpen(): void {
    this.clearHalfOpenTimer();
    this.halfOpenTimer = setTimeout(() => {
      if (this.state === CircuitState.OPEN) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }, this.config.timeout);
  }
  
  private clearTimers(): void {
    this.clearResetTimer();
    this.clearHalfOpenTimer();
  }
  
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }
  
  private clearHalfOpenTimer(): void {
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = undefined;
    }
  }
  
  getState(): CircuitState {
    return this.state;
  }
  
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }
  
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failures = 0;
    this.successes = 0;
    this.totalCalls = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.lastFailure = undefined;
    this.lastSuccess = undefined;
    this.clearTimers();
    this.emit('reset');
  }
  
  destroy(): void {
    this.clearTimers();
    this.removeAllListeners();
  }
}

// Circuit Breaker Manager
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();
  
  create(config: CircuitBreakerConfig): CircuitBreaker {
    if (this.breakers.has(config.name)) {
      throw new Error(`Circuit breaker already exists: ${config.name}`);
    }
    
    const breaker = new CircuitBreaker(config);
    this.breakers.set(config.name, breaker);
    
    // Log state changes
    breaker.on('stateChange', ({ from, to }) => {
      console.log(`Circuit ${config.name}: ${from} -> ${to}`);
    });
    
    return breaker;
  }
  
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }
  
  getOrCreate(config: CircuitBreakerConfig): CircuitBreaker {
    return this.get(config.name) || this.create(config);
  }
  
  remove(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.destroy();
      this.breakers.delete(name);
    }
  }
  
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }
  
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
  
  destroy(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

// Global circuit breaker manager
export const circuitBreakerManager = new CircuitBreakerManager();