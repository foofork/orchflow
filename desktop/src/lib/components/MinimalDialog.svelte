<script>
  export let show = false;
  export let title = '';
</script>

{#if show}
  <div class="backdrop" data-testid="backdrop">
    <div class="dialog" data-testid="dialog">
      {#if title}
        <h3>{title}</h3>
      {/if}
      <div data-testid="content">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .dialog {
    background: white;
    padding: 20px;
    border-radius: 8px;
  }
</style>