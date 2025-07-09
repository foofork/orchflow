<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import { fade } from 'svelte/transition';
  
  export let x: number;
  export let y: number;
  export let testMode = false;
  export let autoFocus = true;
  export let closeOnOutsideClick = true;
  export let closeOnEscape = true;
  export let ariaLabel = 'Context menu';
  
  const dispatch = createEventDispatcher();
  
  let menu: HTMLDivElement;
  let adjustedX = x;
  let adjustedY = y;
  let menuItems: HTMLElement[] = [];
  let focusedIndex = 0;
  let cleanupFunctions: (() => void)[] = [];
  
  function getMenuItems(): HTMLElement[] {
    if (!menu) return [];
    
    const items = Array.from(menu.querySelectorAll(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )) as HTMLElement[];
    
    return items;
  }
  
  function focusItem(index: number) {
    if (testMode) return;
    
    menuItems = getMenuItems();
    if (menuItems.length === 0) return;
    
    // Ensure index is within bounds
    focusedIndex = Math.max(0, Math.min(index, menuItems.length - 1));
    
    // Remove focus from all items
    menuItems.forEach(item => {
      item.classList.remove('focused');
      item.removeAttribute('aria-selected');
    });
    
    // Focus the selected item
    const item = menuItems[focusedIndex];
    if (item) {
      item.classList.add('focused');
      item.setAttribute('aria-selected', 'true');
      item.focus();
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Escape':
        if (closeOnEscape) {
          event.preventDefault();
          dispatch('close');
        }
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        focusItem(focusedIndex + 1);
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        focusItem(focusedIndex - 1);
        break;
        
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
        
      case 'End':
        event.preventDefault();
        focusItem(menuItems.length - 1);
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (menuItems[focusedIndex]) {
          menuItems[focusedIndex].click();
        }
        break;
        
      case 'Tab':
        // Allow tabbing within menu but prevent leaving
        event.preventDefault();
        if (event.shiftKey) {
          focusItem(focusedIndex - 1);
        } else {
          focusItem(focusedIndex + 1);
        }
        break;
    }
  }
  
  function handleClick(event: MouseEvent) {
    if (!closeOnOutsideClick || !menu) return;
    
    if (!menu.contains(event.target as Node)) {
      dispatch('close');
    }
  }
  
  function handleMenuItemClick(event: MouseEvent) {
    // Find the clicked item's index
    const clickedItem = event.target as HTMLElement;
    const itemIndex = menuItems.indexOf(clickedItem);
    
    if (itemIndex !== -1) {
      focusedIndex = itemIndex;
      dispatch('itemClick', { 
        index: itemIndex, 
        item: clickedItem,
        value: clickedItem.getAttribute('data-value') || clickedItem.textContent?.trim()
      });
    }
  }
  
  async function setupMenu() {
    if (!menu || testMode) return;
    
    await tick();
    
    // Adjust position to keep menu on screen
    const rect = menu.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    adjustedX = x;
    adjustedY = y;
    
    if (x + rect.width > windowWidth) {
      adjustedX = x - rect.width;
    }
    
    if (y + rect.height > windowHeight) {
      adjustedY = y - rect.height;
    }
    
    // Set up menu items
    menuItems = getMenuItems();
    
    // Add click handlers to menu items
    menuItems.forEach(item => {
      item.addEventListener('click', handleMenuItemClick);
    });
    
    // Focus first item if autoFocus is enabled
    if (autoFocus && menuItems.length > 0) {
      focusItem(0);
    }
    
    // Set up event listeners
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
    
    cleanupFunctions.push(() => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeydown);
      menuItems.forEach(item => {
        item.removeEventListener('click', handleMenuItemClick);
      });
    });
  }
  
  onMount(setupMenu);
  
  onDestroy(() => {
    cleanupFunctions.forEach(cleanup => cleanup());
  });
</script>

<div 
  class="context-menu"
  bind:this={menu}
  style="left: {adjustedX}px; top: {adjustedY}px"
  transition:fade={{ duration: 150 }}
  role="menu"
  aria-label={ariaLabel}
  tabindex="-1"
  data-testid="context-menu"
>
  <slot />
</div>

<style>
  .context-menu {
    position: fixed;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 4px;
    min-width: 150px;
    z-index: 1000;
    font-size: 13px;
    outline: none;
  }
  
  :global(.context-menu button),
  :global(.context-menu [role="menuitem"]) {
    font-family: var(--font-family);
    display: block;
    width: 100%;
    padding: 6px 12px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--fg-primary);
    cursor: pointer;
    font-size: 13px;
    text-align: left;
    transition: background-color 0.1s;
    outline: none;
  }
  
  :global(.context-menu button:hover),
  :global(.context-menu [role="menuitem"]:hover),
  :global(.context-menu button.focused),
  :global(.context-menu [role="menuitem"].focused) {
    background: var(--bg-hover);
  }
  
  :global(.context-menu button:disabled),
  :global(.context-menu [role="menuitem"]:disabled) {
    color: var(--fg-disabled);
    cursor: not-allowed;
  }
  
  :global(.context-menu button:disabled:hover),
  :global(.context-menu [role="menuitem"]:disabled:hover) {
    background: none;
  }
  
  :global(.context-menu hr) {
    margin: 4px 0;
    border: none;
    border-top: 1px solid var(--border);
  }
  
  :global(.context-menu .menu-item-icon) {
    display: inline-block;
    width: 16px;
    height: 16px;
    margin-right: 8px;
    vertical-align: middle;
  }
  
  :global(.context-menu .menu-item-label) {
    flex: 1;
  }
  
  :global(.context-menu .menu-item-shortcut) {
    margin-left: auto;
    color: var(--fg-secondary);
    font-size: 11px;
  }
</style>