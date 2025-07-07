// Utility for lazy loading Svelte components

interface LazyComponent<T = any> {
  default: T;
}

// Create a lazy component loader with loading state
export function createLazyComponent<T = any>(
  loader: () => Promise<LazyComponent<T>>
) {
  let component: T | null = null;
  let loading = false;
  let error: Error | null = null;
  
  const load = async () => {
    if (component) return component;
    
    loading = true;
    try {
      const module = await loader();
      component = module.default;
      return component;
    } catch (e) {
      error = e as Error;
      throw e;
    } finally {
      loading = false;
    }
  };
  
  return {
    load,
    get component() { return component; },
    get loading() { return loading; },
    get error() { return error; }
  };
}

// Preload components in the background after initial render
export function preloadComponents(loaders: Array<() => Promise<any>>) {
  // Wait a bit for the UI to settle
  setTimeout(() => {
    loaders.forEach(loader => {
      // Preload but don't await
      loader().catch(e => console.warn('Preload failed:', e));
    });
  }, 1000);
}