module.exports = {
  ci: {
    collect: {
      // Build and run a web server
      staticDistDir: './build',
      numberOfRuns: 3,
      settings: {
        // Add Chrome flags to handle Tauri environment
        chromeFlags: '--disable-gpu --no-sandbox --disable-web-security',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
      }
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance thresholds
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'interactive': ['warn', { maxNumericValue: 3500 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        
        // Bundle size constraints
        'total-byte-weight': ['warn', { maxNumericValue: 10485760 }], // 10MB
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 2000 }],
        
        // Best practices
        'uses-http2': 'off', // Disabled for local testing
        'uses-long-cache-ttl': 'off', // Disabled for development
        
        // Accessibility
        'categories:accessibility': ['error', { minScore: 0.9 }],
        
        // SEO
        'categories:seo': ['warn', { minScore: 0.9 }]
      }
    },
    upload: {
      target: 'temporary-public-storage',
      uploadUrlMap: true,
      githubToken: process.env.GITHUB_TOKEN || '',
      githubAppToken: process.env.LHCI_GITHUB_APP_TOKEN || ''
    }
  }
};