<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { orchestrator } from '$lib/stores/orchestrator';
  import UpdateNotification from '$lib/components/UpdateNotification.svelte';
  import { initTheme, setupThemeShortcut } from '$lib/services/theme';
  import '../app.css';
  
  onMount(() => {
    // Initialize theme
    initTheme();
    setupThemeShortcut();
    
    // The new orchestrator is always connected (Tauri)
    // No need to connect/disconnect
    
    // Initialize the orchestrator store
    orchestrator.init();
    
    return () => {
      // Clean up orchestrator resources
      orchestrator.destroy();
    };
  });
</script>

<UpdateNotification />
<slot />