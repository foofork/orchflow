<script>
  export let show = false;
  export let title = '';
  
  console.log('TestDialog - show prop:', show);
  console.log('TestDialog - title prop:', title);
</script>

<div data-testid="test-dialog-root">
  <p>Show value: {show}</p>
  {#if show}
    <div data-testid="test-dialog" class="dialog">
      <h3>{title}</h3>
      <slot />
    </div>
  {:else}
    <p data-testid="not-shown">Dialog not shown</p>
  {/if}
</div>