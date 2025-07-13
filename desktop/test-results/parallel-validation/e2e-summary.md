# E2E Parallel Execution Validation Report

## Summary
- **Total Tests**: 6
- **Passed**: 5 (83%)
- **Failed**: 1
- **Errors**: 0
- **Average Duration**: 6161ms
- **Max Concurrent**: 6

## Test Results


### sequential
- **Status**: ✅ PASSED
- **Duration**: 4321ms
- **Details**: N/A

### dual-worker
- **Status**: ✅ PASSED
- **Duration**: 4451ms
- **Details**: N/A

### quad-worker
- **Status**: ✅ PASSED
- **Duration**: 6509ms
- **Details**: N/A

### resource-cleanup
- **Status**: ❌ FAILED
- **Duration**: 7000ms
- **Details**: [
  {
    "port": 5191,
    "released": true
  },
  {
    "port": 5192,
    "released": false
  }
]

### max-concurrent
- **Status**: ✅ PASSED
- **Duration**: 7717ms
- **Details**: N/A

### result-accuracy
- **Status**: ✅ PASSED
- **Duration**: 6970ms
- **Details**: {
  "totalRuns": 3,
  "successfulRuns": 3,
  "allPassed": true,
  "consistentResults": true
}


## Performance Metrics


- **basicParallel**: 15281ms

- **concurrentExecution**: 7717ms


## Port Allocations


- **Test**: test-0
- **Port**: 5191
- **Success**: ✅
- **Duration**: 3183ms

- **Test**: test-1
- **Port**: 5192
- **Success**: ✅
- **Duration**: 4059ms

- **Test**: test-2
- **Port**: 5193
- **Success**: ✅
- **Duration**: 2076ms


## Recommendations



## Errors



---
*Generated on 7/13/2025, 4:24:27 AM*
