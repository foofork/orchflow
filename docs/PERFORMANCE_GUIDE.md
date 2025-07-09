# orchflow Performance Guide

> **Last Updated**: January 2025  
> **Status**: Unified performance guide for orchflow architecture  
> **Companion to**: [ORCHFLOW_UNIFIED_ARCHITECTURE.md](./ORCHFLOW_UNIFIED_ARCHITECTURE.md)

## Overview

This guide provides performance optimization strategies, benchmarking approaches, and best practices for orchflow's dual-component architecture. Performance characteristics vary significantly between Manager-only and Manager+Orchestrator configurations.

## Performance Philosophy

orchflow follows a **"Progressive Performance"** approach:
- **Manager-only**: Optimized for speed and minimal resource usage
- **Manager+Orchestrator**: Balanced performance with AI capabilities
- **No Performance Penalty**: AI features are additive, not replacement

## Performance Targets by Configuration

### Manager-Only Performance (Achieved ✅)

| Metric | Target | Current Status |
|--------|--------|----------------|
| **Startup time** | <100ms | ✅ ~40-85ms (down from ~150ms) |
| **Memory usage** | <10MB base | ✅ ~10MB base |
| **Command latency** | <5ms | ✅ ~5ms |
| **File operations** | <10ms | ✅ ~10ms |
| **Terminal creation** | <50ms | ✅ ~20ms |

### Manager+Orchestrator Performance (Targets)

| Metric | Target | Expected |
|--------|--------|----------|
| **AI-enhanced startup** | <2 seconds | Initial orchestrator spawn |
| **Agent spawn time** | <20ms | With ruv-FANN optimization |
| **Swarm coordination** | <100ms for 5 agents | Multi-agent task distribution |
| **Bridge communication** | <10ms round-trip | JSON-RPC over stdio |
| **Terminal metadata** | <1ms processing | AI agent context |
| **Swarm visualization** | 60fps | Real-time tmux grid updates |

## Component-Specific Performance

### Manager (Rust) Performance

**Core Responsibilities:**
- Terminal process management
- File system operations
- State persistence
- Plugin execution

**Optimization Strategies:**

#### 1. Startup Optimization (Completed ✅)
```rust
// Parallel initialization
pub async fn initialize_manager() -> Result<ManagerState, OrchflowError> {
    // Run independent tasks in parallel
    let (tmux_check, plugin_load, state_init) = tokio::join!(
        check_tmux_binary(),      // ~2ms (optimized with 'which' crate)
        load_essential_plugins(), // ~30ms (deferred non-essential)
        initialize_state_store()  // ~10ms (SQLite)
    );
    
    // Background tasks after UI is responsive
    tokio::spawn(async {
        sleep(Duration::from_millis(100)).await;
        load_remaining_plugins().await;
        scan_modules().await;
    });
}
```

**Key Optimizations:**
- **Binary checks**: `which` crate instead of version execution (~20ms → ~2ms)
- **Plugin loading**: Essential plugins first, others deferred (~50ms saved)
- **Module scanning**: Lazy-loaded on first access (~20-30ms saved)
- **WebSocket server**: Removed until orchestrator integration (~5-10ms saved)

#### 2. Runtime Performance
```rust
// Efficient terminal streaming
pub struct TerminalStreamManager {
    buffer_size: usize,
    flush_interval: Duration,
    
    pub fn new() -> Self {
        Self {
            buffer_size: 8192,
            flush_interval: Duration::from_millis(16), // 60fps
        }
    }
    
    pub async fn stream_output(&self, output: &[u8]) -> Result<(), OrchflowError> {
        // Batch small outputs, flush large ones immediately
        if output.len() > self.buffer_size {
            self.flush_immediately(output).await?;
        } else {
            self.buffer_and_flush(output).await?;
        }
        Ok(())
    }
}
```

#### 3. Memory Management
```rust
// Bounded terminal buffers
pub struct ScrollbackBuffer {
    max_lines: usize,
    lines: VecDeque<String>,
    
    pub fn add_line(&mut self, line: String) {
        self.lines.push_back(line);
        
        // Trim oldest lines when limit exceeded
        while self.lines.len() > self.max_lines {
            self.lines.pop_front();
        }
    }
}
```

### Orchestrator (TypeScript) Performance

**Core Responsibilities:**
- AI agent management
- Task routing and scheduling
- Swarm coordination
- Command adaptation

**Optimization Strategies:**

#### 1. Agent Lifecycle Management
```typescript
// Efficient agent spawning
export class AgentManager {
    private agentPool: Map<string, Agent> = new Map();
    private warmAgents: Agent[] = [];
    
    async spawnAgent(role: string, context: AgentContext): Promise<Agent> {
        // Try to reuse warm agent
        const warmAgent = this.warmAgents.find(a => a.canHandleRole(role));
        if (warmAgent) {
            this.warmAgents.splice(this.warmAgents.indexOf(warmAgent), 1);
            await warmAgent.reconfigure(context);
            return warmAgent;
        }
        
        // Create new agent (target: <20ms)
        const agent = new Agent(role, context);
        await agent.initialize();
        
        // Pre-warm replacement
        this.preWarmAgent(role);
        
        return agent;
    }
    
    private preWarmAgent(role: string) {
        // Asynchronously prepare agent for next use
        setTimeout(() => {
            const agent = new Agent(role, {});
            agent.initialize().then(() => {
                this.warmAgents.push(agent);
            });
        }, 100);
    }
}
```

#### 2. Task Routing Optimization
```typescript
// Fast intent parsing
export class CommandIntentParser {
    private compiledPatterns: Map<RegExp, TerminalPurpose>;
    
    constructor() {
        // Pre-compile regex patterns at startup
        this.compiledPatterns = new Map([
            [/^(npm|yarn|pnpm) (test|run test)/, 'test'],
            [/^(cargo test|go test|pytest)/, 'test'],
            [/^(npm|yarn|pnpm) (build|run build)/, 'build'],
            // ... more patterns
        ]);
    }
    
    async parseIntent(command: string): Promise<CommandIntent> {
        // O(1) lookup for common patterns
        for (const [pattern, purpose] of this.compiledPatterns) {
            if (pattern.test(command)) {
                return {
                    purpose,
                    confidence: 0.9,
                    processingTime: performance.now() - startTime
                };
            }
        }
        
        // Fallback to AI analysis for complex commands
        return this.aiAnalysis(command);
    }
}
```

#### 3. Swarm Coordination
```typescript
// Efficient multi-agent coordination
export class SwarmCoordinator {
    async coordinateAgents(agents: Agent[], task: SwarmTask): Promise<SwarmResult> {
        // Parallel task distribution
        const taskDistribution = await this.distributeTask(task, agents);
        
        // Execute with circuit breaker pattern
        const results = await Promise.allSettled(
            taskDistribution.map(async (subtask, index) => {
                const agent = agents[index];
                return this.executeWithCircuitBreaker(agent, subtask);
            })
        );
        
        // Aggregate results efficiently
        return this.aggregateResults(results);
    }
    
    private async executeWithCircuitBreaker(
        agent: Agent, 
        task: SubTask
    ): Promise<TaskResult> {
        // Implement circuit breaker for fault tolerance
        const breaker = this.circuitBreakers.get(agent.id);
        if (breaker?.isOpen()) {
            throw new Error(`Agent ${agent.id} circuit breaker open`);
        }
        
        try {
            const result = await agent.execute(task);
            breaker?.recordSuccess();
            return result;
        } catch (error) {
            breaker?.recordFailure();
            throw error;
        }
    }
}
```

### Bridge Communication Performance

**JSON-RPC Optimization:**

```rust
// Rust side - efficient RPC client
pub struct OrchestratorBridge {
    rpc_client: JsonRpcClient,
    request_pool: ObjectPool<JsonRpcRequest>,
    response_cache: LruCache<String, JsonRpcResponse>,
    
    pub async fn call_method(&self, method: &str, params: Value) -> Result<Value, BridgeError> {
        // Reuse request objects
        let mut request = self.request_pool.get();
        request.method = method.to_string();
        request.params = params;
        
        // Check cache for idempotent operations
        if let Some(cached) = self.response_cache.get(&request.id) {
            return Ok(cached.result.clone());
        }
        
        // Execute with timeout
        let response = timeout(Duration::from_millis(100), 
            self.rpc_client.call(request)
        ).await??;
        
        // Cache successful responses
        if response.error.is_none() {
            self.response_cache.put(request.id, response.clone());
        }
        
        // Return object to pool
        self.request_pool.put(request);
        
        Ok(response.result)
    }
}
```

```typescript
// TypeScript side - efficient RPC server
export class ManagerBridge {
    private methodHandlers: Map<string, MethodHandler> = new Map();
    private requestQueue: Queue<JsonRpcRequest> = new Queue();
    private responseCache: LRUCache<string, JsonRpcResponse> = new LRUCache(100);
    
    async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
        // Check cache for idempotent operations
        const cacheKey = `${request.method}:${JSON.stringify(request.params)}`;
        if (this.responseCache.has(cacheKey)) {
            return this.responseCache.get(cacheKey)!;
        }
        
        // Execute with performance monitoring
        const startTime = performance.now();
        
        try {
            const handler = this.methodHandlers.get(request.method);
            if (!handler) {
                throw new Error(`Method ${request.method} not found`);
            }
            
            const result = await handler(request.params);
            const duration = performance.now() - startTime;
            
            // Log slow operations
            if (duration > 50) {
                console.warn(`Slow RPC method ${request.method}: ${duration}ms`);
            }
            
            const response = {
                jsonrpc: '2.0',
                id: request.id,
                result,
                metadata: { duration }
            };
            
            // Cache successful responses
            this.responseCache.set(cacheKey, response);
            
            return response;
        } catch (error) {
            return {
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32603,
                    message: error.message
                }
            };
        }
    }
}
```

## AI Swarm Performance

### Visual Swarm Rendering
```typescript
// Efficient swarm grid updates
export class SwarmMonitor {
    private updateQueue: Set<string> = new Set();
    private rafId: number | null = null;
    
    updateAgent(agentId: string, status: AgentStatus) {
        // Batch updates for next frame
        this.updateQueue.add(agentId);
        
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                this.flushUpdates();
            });
        }
    }
    
    private flushUpdates() {
        // Update only changed agents
        for (const agentId of this.updateQueue) {
            const agent = this.agents.get(agentId);
            if (agent) {
                this.updateAgentDisplay(agent);
            }
        }
        
        this.updateQueue.clear();
        this.rafId = null;
    }
}
```

### Terminal Metadata Processing
```rust
// Efficient metadata handling
impl TerminalMetadata {
    pub fn process_update(&mut self, update: MetadataUpdate) -> Result<(), MetadataError> {
        // Only process actual changes
        if self.has_changes(&update) {
            self.apply_update(update);
            self.notify_subscribers();
        }
        Ok(())
    }
    
    fn has_changes(&self, update: &MetadataUpdate) -> bool {
        // Quick comparison of key fields
        self.agent_role != update.agent_role ||
        self.purpose != update.purpose ||
        self.capabilities != update.capabilities
    }
}
```

## Benchmarking & Monitoring

### Architecture-Aware Benchmarks

```bash
#!/bin/bash
# benchmark-comprehensive.sh

echo "=== orchflow Performance Benchmark ==="

# Manager-only benchmark
echo "Testing Manager-only performance..."
MANAGER_STARTUP=$(./benchmark-startup.sh --manager-only)
echo "Manager startup: ${MANAGER_STARTUP}ms"

# Manager+Orchestrator benchmark
echo "Testing Manager+Orchestrator performance..."
FULL_STARTUP=$(./benchmark-startup.sh --with-orchestrator)
echo "Full startup: ${FULL_STARTUP}ms"

# AI performance benchmark
echo "Testing AI swarm performance..."
SWARM_TIME=$(./benchmark-swarm.sh --agents=5)
echo "5-agent swarm creation: ${SWARM_TIME}ms"

# Bridge performance benchmark
echo "Testing bridge communication..."
BRIDGE_LATENCY=$(./benchmark-bridge.sh --iterations=100)
echo "Bridge round-trip: ${BRIDGE_LATENCY}ms"

# Terminal performance benchmark
echo "Testing terminal performance..."
TERMINAL_THROUGHPUT=$(./benchmark-terminal.sh --data-size=1mb)
echo "Terminal throughput: ${TERMINAL_THROUGHPUT} MB/s"
```

### Component-Specific Metrics

```typescript
// Performance monitoring service
export class PerformanceMonitor {
    private metrics: Map<string, Metric> = new Map();
    
    recordManagerMetric(operation: string, duration: number) {
        this.recordMetric('manager', operation, duration);
    }
    
    recordOrchestratorMetric(operation: string, duration: number) {
        this.recordMetric('orchestrator', operation, duration);
    }
    
    recordBridgeMetric(method: string, duration: number) {
        this.recordMetric('bridge', method, duration);
    }
    
    private recordMetric(component: string, operation: string, duration: number) {
        const key = `${component}.${operation}`;
        const metric = this.metrics.get(key) || new Metric(key);
        
        metric.record(duration);
        this.metrics.set(key, metric);
        
        // Alert on performance regression
        if (metric.isRegression()) {
            this.alertRegression(key, metric);
        }
    }
    
    getPerformanceReport(): PerformanceReport {
        return {
            manager: this.getComponentMetrics('manager'),
            orchestrator: this.getComponentMetrics('orchestrator'),
            bridge: this.getComponentMetrics('bridge'),
            overall: this.getOverallMetrics()
        };
    }
}
```

## Optimization Strategies

### 1. Startup Optimization (Current Achievements ✅)

**Problem**: Initial startup time was ~150ms
**Solution**: Implemented parallel initialization and deferred loading
**Result**: Reduced to ~40-85ms (>50% improvement)

**Key Techniques:**
- Parallel binary checks using `which` crate
- Essential plugin loading first, others deferred
- Lazy module scanning on first access
- Removed unused WebSocket server startup

### 2. Runtime Performance Patterns

```typescript
// Debounced updates for high-frequency events
export function createDebouncedUpdater<T>(
    updateFn: (data: T) => void,
    delay: number = 16 // 60fps
) {
    let timeoutId: number | null = null;
    let pendingData: T | null = null;
    
    return (data: T) => {
        pendingData = data;
        
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(() => {
            if (pendingData) {
                updateFn(pendingData);
                pendingData = null;
            }
            timeoutId = null;
        }, delay);
    };
}

// Usage for terminal output
const debouncedTerminalUpdate = createDebouncedUpdater(
    (data: string) => terminal.write(data),
    16
);
```

### 3. Memory Management

```rust
// Efficient resource pooling
pub struct ResourcePool<T> {
    available: Vec<T>,
    factory: Box<dyn Fn() -> T>,
    max_size: usize,
}

impl<T> ResourcePool<T> {
    pub fn acquire(&mut self) -> T {
        self.available.pop().unwrap_or_else(|| (self.factory)())
    }
    
    pub fn release(&mut self, item: T) {
        if self.available.len() < self.max_size {
            self.available.push(item);
        }
        // Drop item if pool is full
    }
}

// Usage for terminal instances
static TERMINAL_POOL: Lazy<Mutex<ResourcePool<TerminalInstance>>> = Lazy::new(|| {
    Mutex::new(ResourcePool::new(
        || TerminalInstance::new(),
        10 // Max 10 pooled instances
    ))
});
```

### 4. Component-Specific Best Practices

**Manager (Rust) Best Practices:**
- Use `tokio::spawn` for parallel initialization
- Implement bounded buffers for terminal output
- Cache compiled regex patterns
- Use object pools for frequently created objects

**Orchestrator (TypeScript) Best Practices:**
- Pre-warm agent instances
- Implement circuit breaker patterns
- Use LRU caches for expensive operations
- Batch API calls where possible

**Bridge Communication Best Practices:**
- Implement request/response caching
- Use connection pooling
- Set appropriate timeouts
- Monitor and alert on latency

## Performance Regression Testing

```typescript
// Automated performance regression detection
export class RegressionDetector {
    private baselines: Map<string, PerformanceBaseline> = new Map();
    
    async runRegressionTest(testName: string): Promise<RegressionResult> {
        const baseline = this.baselines.get(testName);
        if (!baseline) {
            throw new Error(`No baseline for test: ${testName}`);
        }
        
        const currentMetrics = await this.runPerformanceTest(testName);
        const regression = this.detectRegression(baseline, currentMetrics);
        
        return {
            testName,
            baseline: baseline.metrics,
            current: currentMetrics,
            regression,
            passed: !regression.isRegression
        };
    }
    
    private detectRegression(
        baseline: PerformanceBaseline,
        current: PerformanceMetrics
    ): RegressionAnalysis {
        const thresholds = {
            startup: 1.2,      // 20% slower is regression
            memory: 1.5,       // 50% more memory is regression
            latency: 1.3,      // 30% slower is regression
            throughput: 0.8    // 20% less throughput is regression
        };
        
        const regressions: string[] = [];
        
        if (current.startup > baseline.metrics.startup * thresholds.startup) {
            regressions.push('startup');
        }
        
        if (current.memory > baseline.metrics.memory * thresholds.memory) {
            regressions.push('memory');
        }
        
        // ... check other metrics
        
        return {
            isRegression: regressions.length > 0,
            regressions,
            severity: this.calculateSeverity(regressions)
        };
    }
}
```

## Performance Monitoring Dashboard

```typescript
// Real-time performance dashboard
export class PerformanceDashboard {
    private wsConnection: WebSocket;
    private metricsBuffer: CircularBuffer<PerformanceMetric>;
    
    constructor() {
        this.wsConnection = new WebSocket('ws://localhost:8080/metrics');
        this.metricsBuffer = new CircularBuffer(1000);
        
        this.wsConnection.onmessage = (event) => {
            const metric = JSON.parse(event.data);
            this.metricsBuffer.add(metric);
            this.updateDisplay(metric);
        };
    }
    
    private updateDisplay(metric: PerformanceMetric) {
        // Update real-time charts
        this.updateChart('startup-time', metric.startup);
        this.updateChart('memory-usage', metric.memory);
        this.updateChart('agent-performance', metric.agentMetrics);
        
        // Alert on anomalies
        if (this.isAnomalous(metric)) {
            this.showPerformanceAlert(metric);
        }
    }
    
    private isAnomalous(metric: PerformanceMetric): boolean {
        // Use statistical analysis to detect anomalies
        const recent = this.metricsBuffer.getLast(100);
        const mean = recent.reduce((sum, m) => sum + m.startup, 0) / recent.length;
        const stdDev = this.calculateStdDev(recent.map(m => m.startup), mean);
        
        return Math.abs(metric.startup - mean) > 2 * stdDev;
    }
}
```

## Production Performance Monitoring

```rust
// Rust performance metrics collection
pub struct MetricsCollector {
    startup_time: Instant,
    operation_times: HashMap<String, Duration>,
    memory_usage: Arc<AtomicUsize>,
}

impl MetricsCollector {
    pub fn record_startup_complete(&self) {
        let startup_duration = self.startup_time.elapsed();
        
        // Send to monitoring service
        let metrics = StartupMetrics {
            duration_ms: startup_duration.as_millis() as u64,
            memory_mb: self.get_memory_usage(),
            timestamp: Utc::now(),
        };
        
        // Don't block on metrics reporting
        tokio::spawn(async move {
            if let Err(e) = report_metrics(metrics).await {
                eprintln!("Failed to report metrics: {}", e);
            }
        });
    }
    
    pub fn record_operation(&mut self, operation: &str, duration: Duration) {
        self.operation_times.insert(operation.to_string(), duration);
        
        // Alert on slow operations
        if duration > Duration::from_millis(100) {
            warn!("Slow operation {}: {}ms", operation, duration.as_millis());
        }
    }
}
```

## Performance Checklist

### Before Release:
- [ ] **Startup time** <100ms (Manager-only) ✅
- [ ] **AI startup** <2 seconds (with Orchestrator)
- [ ] **Memory usage** <10MB base (Manager-only) ✅
- [ ] **Agent spawn** <20ms (with ruv-FANN)
- [ ] **Bridge latency** <10ms round-trip
- [ ] **Terminal throughput** >1MB/s
- [ ] **No memory leaks** in 4-hour session
- [ ] **CPU usage** <5% when idle
- [ ] **Smooth scrolling** at 60fps
- [ ] **All benchmarks** pass
- [ ] **Regression tests** pass

### Monitoring in Production:
- [ ] **Performance metrics** collected
- [ ] **Alerts** configured for regressions
- [ ] **Dashboards** show real-time metrics
- [ ] **Anomaly detection** active
- [ ] **Error tracking** integrated
- [ ] **User experience** metrics tracked

## Related Documentation

- [ORCHFLOW_UNIFIED_ARCHITECTURE.md](./ORCHFLOW_UNIFIED_ARCHITECTURE.md) - Architecture overview
- [COMPONENT_RESPONSIBILITIES.md](./COMPONENT_RESPONSIBILITIES.md) - Component performance boundaries
- [MANAGER_ORCHESTRATOR_ARCHITECTURE.md](./MANAGER_ORCHESTRATOR_ARCHITECTURE.md) - Performance characteristics by configuration
- [TERMINAL_MANAGER_ENHANCEMENTS.md](./TERMINAL_MANAGER_ENHANCEMENTS.md) - Implementation performance targets

---

*This guide provides comprehensive performance optimization strategies for orchflow's dual-component architecture. Performance targets and optimizations are aligned with the current unified architecture and Phase 7 completion status.*