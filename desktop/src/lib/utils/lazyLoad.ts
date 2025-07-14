/**
 * Utility for lazy loading and preloading Svelte components
 */

// Cache for loaded components
const componentCache = new Map<string, any>();

// Queue for preloading components
const preloadQueue: Array<() => Promise<any>> = [];
let isPreloading = false;

/**
 * Preload components in the background during idle time
 * @param loaders Array of component loader functions
 */
export async function preloadComponents(loaders: Array<() => Promise<any>>) {
  // Add to preload queue
  preloadQueue.push(...loaders);
  
  // Start preloading if not already running
  if (!isPreloading && 'requestIdleCallback' in window) {
    isPreloading = true;
    requestIdleCallback(processPreloadQueue, { timeout: 2000 });
  } else if (!isPreloading) {
    // Fallback for browsers that don't support requestIdleCallback
    isPreloading = true;
    setTimeout(processPreloadQueue, 100);
  }
}

/**
 * Process the preload queue during idle time
 */
async function processPreloadQueue(deadline?: IdleDeadline) {
  while (preloadQueue.length > 0) {
    // Check if we have time to load another component
    if (deadline && deadline.timeRemaining() < 10) {
      // Schedule continuation
      requestIdleCallback(processPreloadQueue, { timeout: 2000 });
      return;
    }
    
    const loader = preloadQueue.shift();
    if (loader) {
      try {
        const module = await loader();
        // Cache the loaded module
        const key = loader.toString();
        componentCache.set(key, module);
      } catch (error) {
        console.error('Failed to preload component:', error);
      }
    }
  }
  
  isPreloading = false;
}

/**
 * Create a lazy loader with caching
 * @param loader Component loader function
 * @returns Cached component loader
 */
export function createLazyLoader<T>(loader: () => Promise<T>): () => Promise<T> {
  const key = loader.toString();
  
  return async () => {
    // Check cache first
    if (componentCache.has(key)) {
      return componentCache.get(key);
    }
    
    // Load and cache
    const module = await loader();
    componentCache.set(key, module);
    return module;
  };
}

/**
 * Intersection Observer for lazy loading components when they come into view
 */
const observerCallbacks = new WeakMap<Element, () => void>();
let intersectionObserver: IntersectionObserver | null = null;

function getIntersectionObserver(): IntersectionObserver {
  if (!intersectionObserver) {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = observerCallbacks.get(entry.target);
            if (callback) {
              callback();
              intersectionObserver?.unobserve(entry.target);
              observerCallbacks.delete(entry.target);
            }
          }
        });
      },
      {
        // Load components when they're 200px away from viewport
        rootMargin: '200px'
      }
    );
  }
  return intersectionObserver;
}

/**
 * Load a component when it comes into view
 * @param element Element to observe
 * @param loader Component loader function
 */
export function loadWhenVisible(element: Element, loader: () => Promise<any>) {
  const observer = getIntersectionObserver();
  observerCallbacks.set(element, async () => {
    try {
      await loader();
    } catch (error) {
      console.error('Failed to load component:', error);
    }
  });
  observer.observe(element);
}

/**
 * Clean up observers
 */
export function cleanupObservers() {
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  observerCallbacks.clear();
}

/**
 * Priority levels for component loading
 */
export enum LoadPriority {
  IMMEDIATE = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3
}

/**
 * Load components based on priority
 */
const priorityQueues = new Map<LoadPriority, Array<() => Promise<any>>>();

export function loadWithPriority(loader: () => Promise<any>, priority: LoadPriority = LoadPriority.NORMAL) {
  if (!priorityQueues.has(priority)) {
    priorityQueues.set(priority, []);
  }
  
  const queue = priorityQueues.get(priority)!;
  queue.push(loader);
  
  // Process immediately for IMMEDIATE priority
  if (priority === LoadPriority.IMMEDIATE) {
    processPriorityQueue(priority);
  } else {
    // Schedule processing for other priorities
    schedulePriorityProcessing();
  }
}

let priorityProcessingScheduled = false;

function schedulePriorityProcessing() {
  if (!priorityProcessingScheduled) {
    priorityProcessingScheduled = true;
    requestAnimationFrame(() => {
      priorityProcessingScheduled = false;
      processPriorityQueues();
    });
  }
}

async function processPriorityQueues() {
  // Process queues in order of priority
  for (const priority of [LoadPriority.HIGH, LoadPriority.NORMAL, LoadPriority.LOW]) {
    await processPriorityQueue(priority);
  }
}

async function processPriorityQueue(priority: LoadPriority) {
  const queue = priorityQueues.get(priority);
  if (!queue || queue.length === 0) return;
  
  // Process all items in the queue
  const loaders = [...queue];
  queue.length = 0;
  
  await Promise.all(loaders.map(loader => loader().catch(console.error)));
}

/**
 * Utility to create a dynamic import with retry logic
 */
export function createRetryableImport<T>(
  importFn: () => Promise<T>,
  maxRetries = 3,
  retryDelay = 1000
): () => Promise<T> {
  return async () => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Failed to import component (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }
    
    throw lastError || new Error('Failed to import component after retries');
  };
}