<script lang="ts">
  export let name: string = '';
  export let size: number = 16;
  export let color: string = 'currentColor';
</script>

<svg width={size} height={size} fill={color} class="icon icon-{name}">
  <!-- Mock icon -->
  <rect x="0" y="0" width={size} height={size} fill="none" />
</svg>

<style>
  .icon {
    display: inline-block;
    vertical-align: middle;
  }
</style>