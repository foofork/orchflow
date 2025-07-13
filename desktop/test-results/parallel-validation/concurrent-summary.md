# Concurrent Test Execution Validation Report

## Summary
- **Total Runs**: 5
- **Passed**: 5 (100%)
- **Failed**: 0
- **Conflicts**: 0
- **Average Duration**: 3569ms
- **Max Concurrent**: 4
- **Resource Efficiency**: 1.69x

## Concurrent Test Runs


### basic-concurrent
- **Status**: ✅ PASSED
- **Type**: e2e-visual
- **Duration**: 7272ms
- **Details**: N/A

### scaled-concurrent
- **Status**: ✅ PASSED
- **Type**: multiple-suites
- **Duration**: 6610ms
- **Details**: [
  {
    "suite": "smoke-tests",
    "type": "e2e",
    "status": "fulfilled",
    "data": {
      "name": "smoke-tests",
      "type": "e2e",
      "success": true,
      "duration": 6610.170836999998,
      "processId": "e2e-1752380751385"
    },
    "error": null
  },
  {
    "suite": "integration-tests",
    "type": "e2e",
    "status": "fulfilled",
    "data": {
      "name": "integration-tests",
      "type": "e2e",
      "success": true,
      "duration": 5918.275823000004,
      "processId": "e2e-1752380751385"
    },
    "error": null
  },
  {
    "suite": "component-tests",
    "type": "visual",
    "status": "fulfilled",
    "data": {
      "name": "component-tests",
      "type": "visual",
      "success": false,
      "duration": 4753.823525,
      "processId": "visual-1752380751385",
      "screenshots": 5
    },
    "error": null
  },
  {
    "suite": "responsive-tests",
    "type": "visual",
    "status": "fulfilled",
    "data": {
      "name": "responsive-tests",
      "type": "visual",
      "success": true,
      "duration": 2063.519510000013,
      "processId": "visual-1752380751385",
      "screenshots": 11
    },
    "error": null
  }
]

### resource-isolation
- **Status**: ✅ PASSED
- **Type**: resource-competition
- **Duration**: 3958ms
- **Details**: {
  "competitors": [
    {
      "type": "e2e",
      "resource": "database",
      "priority": "high"
    },
    {
      "type": "visual",
      "resource": "browser",
      "priority": "medium"
    },
    {
      "type": "e2e",
      "resource": "filesystem",
      "priority": "low"
    },
    {
      "type": "visual",
      "resource": "network",
      "priority": "medium"
    }
  ],
  "conflicts": []
}

### port-management
- **Status**: ✅ PASSED
- **Type**: port-allocation
- **Duration**: 3ms
- **Details**: N/A

### performance-impact
- **Status**: ✅ PASSED
- **Type**: performance-comparison
- **Duration**: 0ms
- **Details**: N/A


## Performance Metrics


- **basicConcurrent**: 7272

- **scaledConcurrent**: 6610

- **sequential**: 12325

- **concurrent**: 7293

- **efficiency**: 2

- **overhead**: -41


## Resource Conflicts

✅ No conflicts detected


## Resource Usage


- **Monitoring Duration**: 36s
- **Average CPU**: 45%
- **Average Memory**: 6087MB
- **Peak Processes**: 4


## Recommendations



## Errors



---
*Generated on 7/13/2025, 4:25:44 AM*
