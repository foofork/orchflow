<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { manager } from '$lib/stores/manager';
  import UpdateNotification from '$lib/components/UpdateNotification.svelte';
  import { initTheme, setupThemeShortcut } from '$lib/services/theme';
  import '../app.css';
  
  onMount(() => {
    // Initialize theme
    initTheme();
    setupThemeShortcut();
    
    // Initialize the manager store
    // Note: manager auto-initializes in non-test environments,
    // but we'll call init() explicitly to ensure it's ready
    manager.init();
    
    return () => {
      // Clean up manager resources
      manager.destroy();
    };
  });
</script>

<UpdateNotification />
<slot />