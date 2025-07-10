module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173'],
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
      numberOfRuns: 3,
      settings: {
        chromeFlags: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--headless'
        ],
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10 * 1024,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        },
        emulatedFormFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        }
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'speed-index': ['error', { maxNumericValue: 4000 }],
        
        // Other performance metrics
        'interactive': ['error', { maxNumericValue: 5000 }],
        'first-meaningful-paint': ['warn', { maxNumericValue: 3000 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        
        // Accessibility audits
        'color-contrast': 'error',
        'heading-order': 'error',
        'landmark-one-main': 'error',
        'aria-labels': 'error',
        'button-name': 'error',
        'link-name': 'error',
        
        // Best practices
        'uses-https': 'off', // Local development
        'no-vulnerable-libraries': 'error',
        'csp-xss': 'warn',
        
        // Progressive Web App
        'installable-manifest': 'off',
        'apple-touch-icon': 'off',
        'maskable-icon': 'off',
        
        // Bundle size audits
        'unused-javascript': ['warn', { maxNumericValue: 200000 }],
        'unused-css-rules': ['warn', { maxNumericValue: 20000 }],
        'render-blocking-resources': 'warn',
        'unminified-css': 'error',
        'unminified-javascript': 'error',
        
        // Image optimization
        'modern-image-formats': 'warn',
        'efficient-animated-content': 'warn',
        'uses-optimized-images': 'warn',
        'uses-responsive-images': 'warn',
        
        // Network optimization
        'uses-text-compression': 'error',
        'uses-rel-preconnect': 'warn',
        'uses-rel-preload': 'warn',
        'critical-request-chains': 'warn'
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
}