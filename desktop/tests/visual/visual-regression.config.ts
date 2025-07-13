import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * Visual regression specific configuration
 */
export const visualRegressionConfig: Partial<PlaywrightTestConfig> = {
  use: {
    // Visual regression specific settings
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true,
    },
    
    // Ensure consistent rendering
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    
    // Browser settings for consistency
    launchOptions: {
      args: [
        '--font-render-hinting=none',
        '--disable-skia-runtime-opts',
        '--disable-system-font-check',
        '--disable-font-subpixel-positioning',
        '--disable-lcd-text',
      ],
    },
    
    // Consistent animations
    reducedMotion: 'reduce',
    forcedColors: 'none',
  },
  
  expect: {
    // Visual comparison settings
    toHaveScreenshot: {
      // Maximum difference in pixels
      maxDiffPixels: 100,
      
      // Threshold for pixel difference (0-1)
      threshold: 0.2,
      
      // Allow small pixel ratio differences
      maxDiffPixelRatio: 0.05,
      
      // Animation handling
      animations: 'disabled',
      
      // Style to apply
      stylePath: './tests/visual/helpers/visual-regression.css',
    },
  },
  
  // Projects for different scenarios
  projects: [
    {
      name: 'visual-chrome',
      use: {
        ...visualRegressionConfig.use,
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'visual-chrome-dark',
      use: {
        ...visualRegressionConfig.use,
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        colorScheme: 'dark',
      },
    },
    {
      name: 'visual-mobile',
      use: {
        ...visualRegressionConfig.use,
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'visual-tablet',
      use: {
        ...visualRegressionConfig.use,
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
      },
    },
    {
      name: 'visual-high-contrast',
      use: {
        ...visualRegressionConfig.use,
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        forcedColors: 'active',
      },
    },
  ],
};

// Viewport configurations for responsive testing
export const viewportConfigs = {
  mobile: {
    small: { width: 320, height: 568 },
    medium: { width: 375, height: 667 },
    large: { width: 414, height: 896 },
  },
  tablet: {
    portrait: { width: 768, height: 1024 },
    landscape: { width: 1024, height: 768 },
  },
  desktop: {
    small: { width: 1280, height: 720 },
    medium: { width: 1920, height: 1080 },
    large: { width: 2560, height: 1440 },
  },
};

// Common selectors for visual testing
export const visualSelectors = {
  // Layout
  header: 'header, [role="banner"]',
  navigation: 'nav, [role="navigation"]',
  main: 'main, [role="main"]',
  sidebar: 'aside, [role="complementary"], .sidebar',
  footer: 'footer, [role="contentinfo"]',
  
  // Components
  button: 'button, [role="button"]',
  input: 'input, textarea, select',
  link: 'a[href]',
  card: '.card, [role="article"]',
  modal: '[role="dialog"], .modal',
  dropdown: '[role="combobox"], .dropdown',
  menu: '[role="menu"], .menu',
  tabs: '[role="tablist"]',
  
  // Interactive
  form: 'form',
  table: 'table',
  list: '[role="list"], ul, ol',
  grid: '.grid, [role="grid"]',
  
  // Feedback
  alert: '[role="alert"], .alert',
  loading: '.loading, .spinner, [role="progressbar"]',
  tooltip: '[role="tooltip"], .tooltip',
  notification: '.notification, .toast',
};

// Animation timings for consistent captures
export const animationTimings = {
  instant: 0,
  fast: 200,
  normal: 300,
  slow: 500,
  verySlow: 1000,
};

// Test data for visual regression
export const visualTestData = {
  // Sample text content
  shortText: 'Lorem ipsum',
  mediumText: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  longText: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  
  // Sample form data
  formData: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-123-4567',
    message: 'This is a test message for visual regression testing.',
  },
  
  // Sample dates (fixed for consistency)
  dates: {
    past: '2023-01-01',
    present: '2024-06-15',
    future: '2025-12-31',
  },
};

// Helper to generate consistent test data
export function generateVisualTestId(prefix: string, index: number): string {
  return `visual-test-${prefix}-${index}`;
}