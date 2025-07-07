import { EventEmitter } from 'events';
import { OrchflowEvents, OrchflowEventMap } from '../types/events';

// Type-safe event emitter
export class TypedEventEmitter<TEventMap extends Record<string, any>> {
  protected emitter = new EventEmitter();
  
  emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): boolean {
    return this.emitter.emit(event as string, data);
  }
  
  on<K extends keyof TEventMap>(
    event: K,
    listener: (data: TEventMap[K]) => void
  ): this {
    this.emitter.on(event as string, listener);
    return this;
  }
  
  off<K extends keyof TEventMap>(
    event: K,
    listener: (data: TEventMap[K]) => void
  ): this {
    this.emitter.off(event as string, listener);
    return this;
  }
  
  once<K extends keyof TEventMap>(
    event: K,
    listener: (data: TEventMap[K]) => void
  ): this {
    this.emitter.once(event as string, listener);
    return this;
  }
  
  removeAllListeners(event?: keyof TEventMap): this {
    this.emitter.removeAllListeners(event as string);
    return this;
  }
  
  listenerCount(event: keyof TEventMap): number {
    return this.emitter.listenerCount(event as string);
  }
}

// Event statistics tracking
interface EventStats {
  count: number;
  lastEmitted: Date | null;
}

// Main event bus implementation
class EventBusImpl extends TypedEventEmitter<OrchflowEventMap> {
  private stats: Map<OrchflowEvents, EventStats> = new Map();
  private debug: boolean = false;
  
  constructor() {
    super();
    this.initializeStats();
    // Increase max listeners to avoid warnings during tests
    this.emitter.setMaxListeners(100);
  }
  
  private initializeStats(): void {
    Object.values(OrchflowEvents).forEach(event => {
      this.stats.set(event, { count: 0, lastEmitted: null });
    });
  }
  
  emit<K extends keyof OrchflowEventMap>(
    event: K,
    data: OrchflowEventMap[K]
  ): boolean {
    // Update stats
    const stat = this.stats.get(event as OrchflowEvents);
    if (stat) {
      stat.count++;
      stat.lastEmitted = new Date();
    }
    
    // Debug logging
    if (this.debug) {
      console.log(`[EventBus] ${String(event)}:`, data);
    }
    
    return super.emit(event, data);
  }
  
  // Wait for an event with optional timeout
  async waitFor<K extends keyof OrchflowEventMap>(
    event: K,
    timeout?: number
  ): Promise<OrchflowEventMap[K]> {
    return new Promise((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            this.off(event, handler);
            reject(new Error(`Timeout waiting for event: ${String(event)}`));
          }, timeout)
        : null;
      
      const handler = (data: OrchflowEventMap[K]) => {
        if (timer) clearTimeout(timer);
        resolve(data);
      };
      
      this.once(event, handler);
    });
  }
  
  // Filtered event listener
  onFiltered<K extends keyof OrchflowEventMap>(
    event: K,
    filter: (data: OrchflowEventMap[K]) => boolean,
    listener: (data: OrchflowEventMap[K]) => void
  ): () => void {
    const filteredListener = (data: OrchflowEventMap[K]) => {
      if (filter(data)) {
        listener(data);
      }
    };
    
    this.on(event, filteredListener);
    
    // Return unsubscribe function
    return () => this.off(event, filteredListener);
  }
  
  // Get event statistics
  getStats(event?: OrchflowEvents): EventStats | Map<OrchflowEvents, EventStats> {
    if (event) {
      return this.stats.get(event) || { count: 0, lastEmitted: null };
    }
    return new Map(this.stats);
  }
  
  // Reset statistics
  resetStats(): void {
    this.initializeStats();
  }
  
  // Enable/disable debug mode
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }
  
  // Batch emit multiple events
  batchEmit(events: Array<{ event: keyof OrchflowEventMap; data: any }>): void {
    events.forEach(({ event, data }) => {
      this.emit(event, data);
    });
  }
}

// Singleton instance
let instance: EventBusImpl | null = null;

// Export singleton event bus
export const EventBus = {
  getInstance(): EventBusImpl {
    if (!instance) {
      instance = new EventBusImpl();
    }
    return instance;
  },
  
  // Convenience methods
  emit<K extends keyof OrchflowEventMap>(
    event: K,
    data: OrchflowEventMap[K]
  ): boolean {
    return this.getInstance().emit(event, data);
  },
  
  on<K extends keyof OrchflowEventMap>(
    event: K,
    listener: (data: OrchflowEventMap[K]) => void
  ): () => void {
    const bus = this.getInstance();
    bus.on(event, listener);
    return () => bus.off(event, listener);
  },
  
  once<K extends keyof OrchflowEventMap>(
    event: K,
    listener: (data: OrchflowEventMap[K]) => void
  ): void {
    this.getInstance().once(event, listener);
  },
  
  waitFor<K extends keyof OrchflowEventMap>(
    event: K,
    timeout?: number
  ): Promise<OrchflowEventMap[K]> {
    return this.getInstance().waitFor(event, timeout);
  },
  
  onFiltered<K extends keyof OrchflowEventMap>(
    event: K,
    filter: (data: OrchflowEventMap[K]) => boolean,
    listener: (data: OrchflowEventMap[K]) => void
  ): () => void {
    return this.getInstance().onFiltered(event, filter, listener);
  },
  
  setDebug(enabled: boolean): void {
    this.getInstance().setDebug(enabled);
  },
};

// Export types
export { OrchflowEvents, type OrchflowEventMap } from '../types/events';