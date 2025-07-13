# Visual Parallel Execution Validation Report

## Summary
- **Total Tests**: 8
- **Passed**: 6 (75%)
- **Failed**: 2
- **Errors**: 0
- **Average Duration**: 3763ms
- **Browsers Used**: 3
- **Screenshots Made**: 9

## Test Results


### chromium-1-instances
- **Status**: ✅ PASSED
- **Duration**: 1442ms
- **Browser**: chromium
- **Instances**: 1
- **Details**: N/A

### chromium-2-instances
- **Status**: ✅ PASSED
- **Duration**: 2256ms
- **Browser**: chromium
- **Instances**: 2
- **Details**: N/A

### chromium-4-instances
- **Status**: ❌ FAILED
- **Duration**: 3136ms
- **Browser**: chromium
- **Instances**: 4
- **Details**: N/A

### firefox-2-instances
- **Status**: ✅ PASSED
- **Duration**: 3134ms
- **Browser**: firefox
- **Instances**: 2
- **Details**: N/A

### webkit-2-instances
- **Status**: ✅ PASSED
- **Duration**: 2948ms
- **Browser**: webkit
- **Instances**: 2
- **Details**: N/A

### concurrent-browsers
- **Status**: ✅ PASSED
- **Duration**: 9530ms
- **Browser**: N/A
- **Instances**: N/A
- **Details**: [
  {
    "browser": "chromium",
    "status": "fulfilled",
    "error": null
  },
  {
    "browser": "firefox",
    "status": "fulfilled",
    "error": null
  },
  {
    "browser": "webkit",
    "status": "fulfilled",
    "error": null
  }
]

### viewport-parallelization
- **Status**: ✅ PASSED
- **Duration**: 2658ms
- **Browser**: N/A
- **Instances**: N/A
- **Details**: [
  {
    "viewport": "desktop",
    "dimensions": "1280x720",
    "status": "fulfilled",
    "data": {
      "viewport": "desktop",
      "dimensions": {
        "width": 1280,
        "height": 720,
        "name": "desktop"
      },
      "screenshots": 3,
      "success": true,
      "duration": 1092.4472358833007
    }
  },
  {
    "viewport": "tablet",
    "dimensions": "768x1024",
    "status": "fulfilled",
    "data": {
      "viewport": "tablet",
      "dimensions": {
        "width": 768,
        "height": 1024,
        "name": "tablet"
      },
      "screenshots": 3,
      "success": true,
      "duration": 1632.9028932318504
    }
  },
  {
    "viewport": "mobile",
    "dimensions": "375x667",
    "status": "fulfilled",
    "data": {
      "viewport": "mobile",
      "dimensions": {
        "width": 375,
        "height": 667,
        "name": "mobile"
      },
      "screenshots": 3,
      "success": false,
      "duration": 3907.6975506886038
    }
  }
]

### resource-cleanup
- **Status**: ❌ FAILED
- **Duration**: 5000ms
- **Browser**: N/A
- **Instances**: N/A
- **Details**: [
  {
    "browserId": "cleanup-test-0",
    "cleanedUp": true
  },
  {
    "browserId": "cleanup-test-1"
  },
  {
    "browserId": "cleanup-test-2"
  }
]


## Performance Metrics


- **browserParallel**: 12917ms

- **concurrentBrowsers**: 9530ms


## Browser Instances


- **Browser**: chromium (Instance 0)
- **Duration**: 1441ms
- **Success**: ✅

- **Browser**: chromium (Instance 0)
- **Duration**: 1374ms
- **Success**: ✅

- **Browser**: chromium (Instance 1)
- **Duration**: 2255ms
- **Success**: ✅

- **Browser**: chromium (Instance 3)
- **Duration**: 1957ms
- **Success**: ✅

- **Browser**: chromium (Instance 1)
- **Duration**: 2325ms
- **Success**: ✅

- **Browser**: chromium (Instance 2)
- **Duration**: 2477ms
- **Success**: ✅

- **Browser**: chromium (Instance 0)
- **Duration**: 3137ms
- **Success**: ✅

- **Browser**: firefox (Instance 1)
- **Duration**: 1187ms
- **Success**: ✅

- **Browser**: firefox (Instance 0)
- **Duration**: 3134ms
- **Success**: ✅

- **Browser**: webkit (Instance 1)
- **Duration**: 1486ms
- **Success**: ✅

- **Browser**: webkit (Instance 0)
- **Duration**: 2947ms
- **Success**: ✅


## Screenshot Comparisons


### Comparison 1
- **Screenshots**: 3
- **Consistent**: ✅
- **Max Difference**: 0.26%

### Comparison 2
- **Screenshots**: 3
- **Consistent**: ✅
- **Max Difference**: 0.94%

### Comparison 3
- **Screenshots**: 3
- **Consistent**: ❌
- **Max Difference**: 7.15%


## Recommendations


### RELIABILITY - HIGH
- **Issue**: High failure rate in visual parallel execution
- **Suggestion**: Review browser instance management and resource allocation

### CONSISTENCY - HIGH
- **Issue**: Screenshot inconsistency detected in parallel runs
- **Suggestion**: Review timing, animation handling, and browser settings


## Errors



---
*Generated on 7/13/2025, 4:25:08 AM*
