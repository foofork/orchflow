<script>
  import Dialog from './Dialog.svelte';
  export let showDialog = false;
</script>

<div data-testid="wrapper">
  <Dialog show={showDialog} title="Wrapped Dialog" testMode={true}>
    <p>Dialog content</p>
  </Dialog>
</div>