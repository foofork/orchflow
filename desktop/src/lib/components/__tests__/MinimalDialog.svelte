<script lang="ts">
  export let show = false;
  export let title = '';
</script>

{#if show}
  <div class="dialog-backdrop" data-testid="dialog-backdrop">
    <div class="dialog" data-testid="dialog">
      {#if title}
        <div class="dialog-header">
          <h3>{title}</h3>
        </div>
      {/if}
      <div class="dialog-content" data-testid="dialog-content">
        <slot />
      </div>
    </div>
  </div>
{/if}