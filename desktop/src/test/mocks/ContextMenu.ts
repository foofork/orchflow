import { SvelteComponent } from 'svelte';

// Create a proper Svelte component mock
export class MockContextMenu extends SvelteComponent {
  constructor(options: any) {
    super(options);
    // Initialize with default props
    this.$$prop_def = {
      x: 0,
      y: 0,
      testMode: false,
      autoFocus: true,
      closeOnOutsideClick: true,
      closeOnEscape: true,
      ariaLabel: 'Context menu'
    };
  }
}

// Export as default to match the import pattern
export default MockContextMenu;