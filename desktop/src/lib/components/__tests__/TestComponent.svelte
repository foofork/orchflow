<script lang="ts">
  export let show = false;
  export let message = 'Hello World';
</script>

{#if show}
  <div data-testid="test-content">{message}</div>
{/if}