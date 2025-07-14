<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { quadOut } from 'svelte/easing';

  export let content: string = '';
  export let placement: 'top' | 'bottom' | 'left' | 'right' = 'top';
  export let delay: number = 500;
  export let offset: number = 8;
  export let arrow: boolean = true;
  export let interactive: boolean = false;
  export let variant: 'default' | 'security' | 'warning' | 'error' = 'default';
  export let maxWidth: string = '200px';
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher();

  let triggerElement: HTMLElement;
  let tooltipElement: HTMLElement;
  let visible = false;
  let mounted = false;
  let showTimer: ReturnType<typeof setTimeout>;
  let hideTimer: ReturnType<typeof setTimeout>;
  let position = { x: 0, y: 0 };

  onMount(() => {
    mounted = true;
  });

  onDestroy(() => {
    if (showTimer) clearTimeout(showTimer);
    if (hideTimer) clearTimeout(hideTimer);
  });

  function calculatePosition() {
    if (!triggerElement || !tooltipElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = 0, y = 0;

    switch (placement) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - offset;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + offset;
        break;
      case 'left':
        x = triggerRect.left - tooltipRect.width - offset;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + offset;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Keep tooltip within viewport bounds
    x = Math.max(8, Math.min(x, viewportWidth - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, viewportHeight - tooltipRect.height - 8));

    position = { x, y };
  }

  function show() {
    if (disabled || !content.trim()) return;
    
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (showTimer) return;

    showTimer = setTimeout(() => {
      visible = true;
      dispatch('show');
      
      // Calculate position after the tooltip is rendered
      setTimeout(calculatePosition, 0);
    }, delay);
  }

  function hide() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }

    if (hideTimer) return;

    hideTimer = setTimeout(() => {
      visible = false;
      dispatch('hide');
    }, interactive ? 100 : 0);
  }

  function handleMouseEnter() {
    show();
  }

  function handleMouseLeave() {
    hide();
  }

  function handleFocus() {
    show();
  }

  function handleBlur() {
    hide();
  }

  function handleTooltipMouseEnter() {
    if (interactive && showTimer) {
      clearTimeout(showTimer);
    }
    if (interactive && hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function handleTooltipMouseLeave() {
    if (interactive) {
      hide();
    }
  }

  function getVariantClass(variant: string): string {
    switch (variant) {
      case 'security':
        return 'tooltip-security';
      case 'warning':
        return 'tooltip-warning';
      case 'error':
        return 'tooltip-error';
      default:
        return 'tooltip-default';
    }
  }

  function getTransitionParams() {
    switch (placement) {
      case 'top':
        return { y: 5, duration: 200, easing: quadOut };
      case 'bottom':
        return { y: -5, duration: 200, easing: quadOut };
      case 'left':
        return { x: 5, duration: 200, easing: quadOut };
      case 'right':
        return { x: -5, duration: 200, easing: quadOut };
      default:
        return { y: 5, duration: 200, easing: quadOut };
    }
  }

  // Update position on scroll or resize
  function handleReposition() {
    if (visible) {
      calculatePosition();
    }
  }

  onMount(() => {
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  });
</script>

<span
  bind:this={triggerElement}
  class="tooltip-trigger"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  on:focus={handleFocus}
  on:blur={handleBlur}
  role="button"
  tabindex="0"
  aria-describedby={visible ? 'tooltip' : undefined}
>
  <slot />
</span>

{#if visible && mounted}
  <div
    bind:this={tooltipElement}
    id="tooltip"
    class="tooltip {getVariantClass(variant)}"
    style="
      position: fixed;
      left: {position.x}px;
      top: {position.y}px;
      max-width: {maxWidth};
      z-index: 9999;
    "
    role="tooltip"
    aria-live="polite"
    transition:fly={getTransitionParams()}
    on:mouseenter={handleTooltipMouseEnter}
    on:mouseleave={handleTooltipMouseLeave}
  >
    <div class="tooltip-content">
      {content}
    </div>
    
    {#if arrow}
      <div class="tooltip-arrow tooltip-arrow-{placement}" />
    {/if}
  </div>
{/if}

<style>
  .tooltip-trigger {
    display: inline-block;
  }

  .tooltip {
    position: fixed;
    padding: 8px 12px;
    font-size: var(--font-body-xs);
    line-height: 1.4;
    border-radius: var(--radius-sm);
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.15),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    pointer-events: auto;
    word-wrap: break-word;
    max-width: inherit;
  }

  .tooltip-content {
    position: relative;
    z-index: 1;
  }

  .tooltip-arrow {
    position: absolute;
    width: 8px;
    height: 8px;
    background: inherit;
    border: inherit;
    transform: rotate(45deg);
  }

  .tooltip-arrow-top {
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
  }

  .tooltip-arrow-bottom {
    top: -4px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
  }

  .tooltip-arrow-left {
    right: -4px;
    top: 50%;
    transform: translateY(-50%) rotate(45deg);
  }

  .tooltip-arrow-right {
    left: -4px;
    top: 50%;
    transform: translateY(-50%) rotate(45deg);
  }

  /* Variant styles */
  .tooltip-default {
    background: rgba(60, 64, 72, 0.95);
    color: var(--fg-primary);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tooltip-security {
    background: rgba(16, 128, 16, 0.95);
    color: white;
    border: 1px solid rgba(32, 255, 32, 0.3);
  }

  .tooltip-warning {
    background: rgba(255, 140, 0, 0.95);
    color: white;
    border: 1px solid rgba(255, 200, 0, 0.3);
  }

  .tooltip-error {
    background: rgba(220, 38, 38, 0.95);
    color: white;
    border: 1px solid rgba(255, 100, 100, 0.3);
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .tooltip-default {
      background: rgba(40, 44, 52, 0.95);
      border-color: rgba(255, 255, 255, 0.15);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .tooltip {
      box-shadow: 
        0 0 0 2px currentColor,
        0 4px 12px rgba(0, 0, 0, 0.3);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .tooltip {
      transition: none;
    }
  }
</style>