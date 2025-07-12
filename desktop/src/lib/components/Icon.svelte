<script lang="ts">
  export let name: string = '';
  export let size: number | 'tiny' | 'small' | 'medium' | 'large' = 16;
  export let color: string = 'currentColor';
  
  // Convert size names to numbers
  const sizeMap = {
    tiny: 12,
    small: 16,
    medium: 20,
    large: 24
  };
  
  $: actualSize = typeof size === 'number' ? size : sizeMap[size] || 16;
</script>

<svg width={actualSize} height={actualSize} fill={color} class="icon icon-{name}">
  <!-- Mock icon -->
  <rect x="0" y="0" width={actualSize} height={actualSize} fill="none" />
</svg>

<style>
  .icon {
    display: inline-block;
    vertical-align: middle;
  }
</style>