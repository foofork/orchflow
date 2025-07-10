# Multi-Project Orchestration Proposal

> **Version**: 1.0  
> **Status**: Proposal  
> **Created**: January 2025  
> **Author**: Architecture Team

## Executive Summary

This proposal outlines the architecture and implementation strategy for enabling orchflow to orchestrate AI-driven development across multiple projects simultaneously. The system will support namespace-isolated terminal groups, project-aware AI agents, and segmented memory coordination through ruv-FANN integration.

## Vision

Enable developers to orchestrate AI agents across multiple projects from a single interface, with each project maintaining its own context, resources, and coordination layer:

```
"AI, work on the e-commerce backend in workspace 1 while refactoring the CLI parser in workspace 2"
```

## Problem Statement

Current limitations:
- Sessions aren't tied to specific projects or repositories
- No namespace isolation between different codebases
- Terminals can't be grouped by project context
- AI agents lack project-specific context boundaries
- Memory and resources are shared globally
- No mechanism for controlled inter-project communication

## Proposed Solution

### 1. Core Architecture

#### Enhanced Data Model

```rust
// New workspace-aware types
pub struct WorkspaceContext {
    pub id: String,
    pub name: String,
    pub root_path: PathBuf,
    pub repo_url: Option<String>,
    pub namespace: String,              // Isolation namespace
    pub metadata: WorkspaceMetadata,
    pub created_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
}

pub struct WorkspaceMetadata {
    pub project_type: ProjectType,      // rust, node, python, mixed
    pub vcs_info: Option<VcsInfo>,      // git metadata
    pub active_agents: Vec<AgentId>,
    pub memory_namespace: String,       // ruv-FANN memory segment
    pub resource_limits: ResourceLimits,
    pub security_tier: SecurityTier,
}

pub struct EnhancedSessionState {
    pub id: String,
    pub name: String,
    pub workspace_id: Option<String>,   // Links to workspace
    pub panes: Vec<String>,
    pub coordination_layer: Option<CoordinationConfig>,
    pub layout: Option<GridLayout>,
}

pub struct CoordinationConfig {
    pub ruv_fann_namespace: String,
    pub agent_pool: AgentPoolConfig,
    pub memory_segment: MemorySegment,
    pub inter_project_communication: bool,
    pub shared_resources: Vec<SharedResourceRef>,
}
```

#### Terminal Namespace Groups

```rust
pub struct NamespacedTerminalGroup {
    pub workspace_id: String,
    pub namespace: String,
    pub terminals: Vec<TerminalId>,
    pub shared_env: HashMap<String, String>,
    pub resource_pool: ResourcePool,
    pub security_policy: WorkspaceSecurityPolicy,
}

pub struct TerminalMetadata {
    pub id: String,
    pub workspace_id: Option<String>,
    pub namespace: Option<String>,
    pub purpose: TerminalPurpose,       // Build, Test, REPL, Agent, etc.
    pub agent_id: Option<AgentId>,      // If controlled by AI
    pub restrictions: TerminalRestrictions,
}
```

### 2. ruv-FANN Integration

#### Namespace-Aware Neural Networks

```rust
pub trait NamespacedNeuralNetwork {
    /// Create isolated neural network for workspace
    fn create_workspace_network(
        &self,
        workspace_id: &str,
        config: NetworkConfig,
    ) -> Result<WorkspaceNetwork>;
    
    /// Get or create memory segment for workspace
    fn get_memory_segment(
        &self,
        namespace: &str,
    ) -> Result<MemorySegment>;
    
    /// Train models with workspace-specific data
    fn train_workspace_models(
        &self,
        workspace_id: &str,
        training_data: &TrainingSet,
    ) -> Result<()>;
}

pub struct WorkspaceNetwork {
    pub id: String,
    pub namespace: String,
    pub models: HashMap<String, NeuralModel>,
    pub memory: SegmentedMemory,
    pub agent_pool: Vec<AgentInstance>,
}

pub struct SegmentedMemory {
    pub namespace: String,
    pub capacity: usize,
    pub isolation_level: MemoryIsolation,
    pub persistence: PersistenceConfig,
}
```

#### Cross-Workspace Coordination

```rust
pub struct CrossWorkspaceBridge {
    pub id: String,
    pub source_workspace: String,
    pub target_workspace: String,
    pub allowed_operations: Vec<BridgeOperation>,
    pub security_policy: BridgeSecurityPolicy,
}

pub enum BridgeOperation {
    ReadOnly { resources: Vec<ResourcePattern> },
    MessagePassing { topics: Vec<String> },
    SharedModel { model_id: String },
    ResourceSharing { resource_type: ResourceType },
}
```

### 3. User Interface Design

#### Workspace Switcher
```
┌─────────────────────────────────────────────┐
│ Workspaces                                  │
├─────────────────────────────────────────────┤
│ 🟢 E-commerce Platform    [4 agents] 45% CPU│
│ 🟢 CLI Tool              [3 agents] 30% CPU│
│ ⭕ Mobile App            [0 agents] 0% CPU │
│                                             │
│ [+ New Workspace]                           │
└─────────────────────────────────────────────┘
```

#### Multi-Project Orchestration View
```
┌─────────────────────────────────────────────────────────┐
│                  Orchestration Dashboard                 │
├─────────────────────┬───────────────────────────────────┤
│   E-commerce API    │         CLI Tool                  │
│   ~/projects/shop   │   ~/projects/awesome-cli          │
├─────────────────────┼───────────────────────────────────┤
│ Agents:             │ Agents:                           │
│ • Backend Dev  🔄   │ • Parser Refactor  ✅             │
│ • API Tester   🔄   │ • Test Runner      🔄             │
│ • DB Migrator  ⏸️   │ • Doc Generator    ⏸️             │
│ • Deployer     ⏸️   │                                   │
├─────────────────────┼───────────────────────────────────┤
│ Resources:          │ Resources:                        │
│ • Memory: 2.1GB     │ • Memory: 1.3GB                   │
│ • CPU: 45%          │ • CPU: 30%                        │
│ • Terminals: 6      │ • Terminals: 4                    │
├─────────────────────┼───────────────────────────────────┤
│ Recent:             │ Recent:                           │
│ • API endpoint done │ • Parser tests passing            │
│ • Starting DB migration │ • Refactoring ast.rs          │
└─────────────────────┴───────────────────────────────────┘
```

#### Terminal Group View
```
┌─────────────────────────────────────────────────────────┐
│ E-commerce API › Terminals                              │
├──────────────┬──────────────┬───────────────────────────┤
│ API Server   │ Test Runner  │ Database                  │
│ [Agent: Dev] │ [Agent: QA]  │ [Agent: DBA]              │
├──────────────┼──────────────┼───────────────────────────┤
│ $ cargo run  │ $ cargo test │ $ psql shop_dev           │
│ Starting...  │ Running...   │ shop_dev=#                │
│              │ ✓ 45 passed  │                           │
├──────────────┴──────────────┴───────────────────────────┤
│ Workspace Context: /home/user/projects/shop             │
│ Namespace: proj-ecommerce | Memory: 2.1GB | Agents: 3/6 │
└─────────────────────────────────────────────────────────┘
```

### 4. Implementation Strategy

#### Phase 1: Workspace Foundation (Weeks 1-2)
- [ ] Add WorkspaceContext to data model
- [ ] Implement workspace CRUD operations
- [ ] Add workspace_id to sessions and terminals
- [ ] Create workspace detection from directories
- [ ] Add basic workspace UI components

#### Phase 2: Terminal Namespacing (Weeks 3-4)
- [ ] Implement NamespacedTerminalGroup
- [ ] Add terminal-to-workspace assignment
- [ ] Create workspace environment isolation
- [ ] Add resource limit enforcement
- [ ] Build workspace security policies

#### Phase 3: ruv-FANN Integration (Weeks 5-6)
- [ ] Implement namespace-aware neural networks
- [ ] Create segmented memory system
- [ ] Add workspace-specific model training
- [ ] Build agent pool isolation
- [ ] Implement coordination layer separation

#### Phase 4: Cross-Workspace Features (Weeks 7-8)
- [ ] Design bridge security model
- [ ] Implement controlled resource sharing
- [ ] Add inter-workspace messaging
- [ ] Create shared model access
- [ ] Build workspace dependency management

### 5. Configuration

#### Workspace Configuration File
```json
{
  "workspace": {
    "id": "proj-ecommerce",
    "name": "E-commerce Platform",
    "root": "/home/user/projects/shop",
    "type": "rust",
    "namespace": {
      "prefix": "shop",
      "isolation": "strict"
    },
    "resources": {
      "max_agents": 8,
      "memory_limit": "4GB",
      "cpu_shares": 1024
    },
    "ruv_fann": {
      "models": ["code_completion", "error_detection"],
      "memory_size": "512MB",
      "training_enabled": true
    },
    "security": {
      "tier": "enhanced",
      "allowed_commands": ["cargo", "npm", "git"],
      "restricted_paths": ["/etc", "/sys"]
    }
  }
}
```

#### Global Orchestration Config
```toml
[orchestration]
max_workspaces = 5
default_agent_limit = 6
enable_cross_workspace = true

[orchestration.ruv_fann]
namespace_isolation = true
shared_model_cache = true
memory_per_workspace = "512MB"

[orchestration.resources]
total_memory_limit = "16GB"
cpu_allocation_strategy = "fair"
terminal_limit_per_workspace = 12
```

### 6. API Design

#### Workspace Management API
```rust
// Create workspace
async fn create_workspace(config: WorkspaceConfig) -> Result<WorkspaceId>;

// List workspaces
async fn list_workspaces() -> Result<Vec<WorkspaceInfo>>;

// Switch active workspace
async fn switch_workspace(workspace_id: &str) -> Result<()>;

// Create terminal in workspace
async fn create_workspace_terminal(
    workspace_id: &str,
    config: TerminalConfig
) -> Result<TerminalId>;

// Spawn agent in workspace
async fn spawn_workspace_agent(
    workspace_id: &str,
    agent_type: AgentType,
    task: AgentTask,
) -> Result<AgentId>;
```

#### Cross-Workspace API
```rust
// Create bridge between workspaces
async fn create_workspace_bridge(
    source: &str,
    target: &str,
    permissions: BridgePermissions,
) -> Result<BridgeId>;

// Send message across workspaces
async fn send_cross_workspace_message(
    bridge_id: &str,
    message: WorkspaceMessage,
) -> Result<()>;

// Share resource between workspaces
async fn share_workspace_resource(
    bridge_id: &str,
    resource: SharedResource,
) -> Result<ResourceRef>;
```

### 7. Security Considerations

#### Workspace Isolation
- Process namespace separation
- Resource limit enforcement
- Directory access restrictions
- Network policy per workspace
- Credential isolation

#### Cross-Workspace Security
- Explicit bridge creation required
- Granular permission model
- Audit trail for all interactions
- Rate limiting on bridges
- Revocable access tokens

### 8. Performance Implications

#### Resource Management
- Dynamic CPU allocation based on activity
- Memory limits with graceful degradation
- I/O bandwidth allocation
- Terminal count limits
- Agent pool sizing

#### Optimization Strategies
- Lazy workspace loading
- Suspended workspace hibernation
- Shared binary caching
- Model deduplication across workspaces
- Efficient context switching

### 9. Migration Path

For existing users:
1. Current sessions become "default workspace"
2. Gradual migration to workspace model
3. Backward compatibility maintained
4. Opt-in workspace features
5. Automated workspace detection

### 10. Success Metrics

- **Isolation**: Zero cross-workspace contamination
- **Performance**: <100ms workspace switch time
- **Scalability**: Support 10+ active workspaces
- **Efficiency**: <10% overhead per workspace
- **Usability**: Single command workspace creation

### 11. Future Enhancements

- **Workspace Templates**: Pre-configured project types
- **Team Workspaces**: Shared collaborative spaces
- **Cloud Workspaces**: Remote workspace execution
- **Workspace Sync**: Multi-device synchronization
- **Dependency Graph**: Visual workspace relationships

## Conclusion

Multi-project orchestration transforms orchflow from a single-project IDE into a comprehensive development command center. By combining workspace isolation, namespace-aware AI agents, and segmented neural networks, developers can efficiently manage multiple projects simultaneously while maintaining clear boundaries and optimal resource utilization.

This architecture positions orchflow as the first IDE truly designed for the multi-project reality of modern development, where developers routinely work across multiple codebases, often with AI assistance, requiring intelligent orchestration and resource management.