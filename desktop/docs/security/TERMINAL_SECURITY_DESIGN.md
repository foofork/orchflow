# OrchFlow Terminal Security Design

## Executive Summary

This document outlines a comprehensive, user-toggleable security system for OrchFlow's terminal subsystem. The design provides granular control over security mechanisms, allowing users to balance security requirements with developer experience based on their specific use cases and threat models.

## Architecture Analysis

### Current Terminal Implementation

OrchFlow's terminal system consists of:

1. **PTY Manager** (`pty_manager.rs`): Manages pseudo-terminal creation and lifecycle
2. **Terminal Commands** (`terminal_commands.rs`): High-level terminal operations
3. **Manager/Handlers** (`manager/handlers/terminal.rs`): Command execution and output handling
4. **Plugin System**: Extensible architecture supporting JavaScript, WASM, and native plugins
5. **State Management**: Centralized state store for session and pane management

### Security Risks Identified

1. **Command Injection**: Unrestricted command execution through PTY
2. **Process Escape**: No process isolation or sandboxing
3. **Plugin Malware**: Plugins have full system access
4. **Data Exfiltration**: No monitoring of terminal output
5. **Resource Exhaustion**: No rate limiting or resource controls
6. **Path Traversal**: Limited validation of working directories
7. **Credential Exposure**: No protection for sensitive data in terminal output

## Security Tiers Design

### Tier 0: Unrestricted Mode (Default for Local Development)
- **Use Case**: Trusted local development
- **Security**: Minimal restrictions
- **Performance**: Maximum performance
- **Features**: All features enabled

### Tier 1: Basic Protection
- **Use Case**: General development with basic safety
- **Features**:
  - Command history sanitization
  - Basic path validation
  - Credential masking in output
  - Plugin signature verification

### Tier 2: Enhanced Security
- **Use Case**: Working with untrusted codebases
- **Features**:
  - Command allowlisting/denylisting
  - Working directory restrictions
  - Network command monitoring
  - Enhanced plugin sandboxing
  - Audit logging

### Tier 3: Restricted Mode
- **Use Case**: High-security environments
- **Features**:
  - Strict command allowlisting
  - Read-only file system access
  - No network commands
  - Mandatory plugin review
  - Full audit trail

### Tier 4: Isolated Mode
- **Use Case**: Untrusted/malicious code analysis
- **Features**:
  - Full process isolation (containers/VMs)
  - No host file system access
  - Airgapped networking
  - Time-boxed execution
  - Forensic logging

## Detailed Security Mechanisms

### 1. Command Execution Protection

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandSecurityPolicy {
    pub mode: CommandSecurityMode,
    pub allowlist: Option<Vec<CommandPattern>>,
    pub denylist: Option<Vec<CommandPattern>>,
    pub require_confirmation: Option<Vec<CommandPattern>>,
    pub audit_commands: bool,
    pub mask_sensitive_args: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommandSecurityMode {
    Unrestricted,
    AllowlistOnly,
    DenylistFilter,
    Interactive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandPattern {
    pub pattern: String,
    pub regex: bool,
    pub risk_level: RiskLevel,
    pub reason: String,
}
```

### 2. Process Isolation

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessIsolationConfig {
    pub enabled: bool,
    pub isolation_type: IsolationType,
    pub resource_limits: ResourceLimits,
    pub network_policy: NetworkPolicy,
    pub filesystem_policy: FilesystemPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IsolationType {
    None,
    ProcessNamespace,
    Container(ContainerConfig),
    VM(VMConfig),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_mb: Option<u64>,
    pub max_cpu_percent: Option<f32>,
    pub max_processes: Option<u32>,
    pub max_open_files: Option<u32>,
    pub execution_timeout_sec: Option<u64>,
}
```

### 3. Workspace Trust Integration

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceTrustConfig {
    pub enabled: bool,
    pub trust_on_first_use: bool,
    pub trusted_paths: Vec<PathBuf>,
    pub parent_folder_trust: bool,
    pub untrusted_restrictions: UntrustedRestrictions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UntrustedRestrictions {
    pub disable_task_running: bool,
    pub disable_debugging: bool,
    pub disable_terminal_creation: bool,
    pub restrict_terminal_commands: bool,
    pub disable_workspace_extensions: bool,
}
```

### 4. Plugin Sandboxing

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSecurityPolicy {
    pub verification_required: bool,
    pub sandbox_mode: PluginSandboxMode,
    pub capability_restrictions: PluginCapabilities,
    pub resource_quotas: PluginResourceQuotas,
    pub api_restrictions: ApiRestrictions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PluginSandboxMode {
    None,
    CapabilityBased,
    ProcessIsolation,
    WasmSandbox,
    ContainerIsolation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiRestrictions {
    pub terminal_access: TerminalAccessLevel,
    pub filesystem_access: FilesystemAccessLevel,
    pub network_access: NetworkAccessLevel,
    pub system_info_access: bool,
}
```

### 5. Audit Logging

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditConfig {
    pub enabled: bool,
    pub log_level: AuditLogLevel,
    pub destinations: Vec<AuditDestination>,
    pub retention_days: u32,
    pub encrypt_logs: bool,
    pub tamper_protection: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub timestamp: DateTime<Utc>,
    pub event_type: AuditEventType,
    pub user: String,
    pub session_id: String,
    pub terminal_id: Option<String>,
    pub command: Option<String>,
    pub working_dir: Option<PathBuf>,
    pub environment: Option<HashMap<String, String>>,
    pub risk_score: u8,
    pub outcome: AuditOutcome,
}
```

### 6. Visual Security Indicators

```typescript
interface SecurityIndicator {
  level: SecurityLevel;
  mode: SecurityMode;
  alerts: SecurityAlert[];
  trustState: WorkspaceTrustState;
}

interface TerminalSecurityBadge {
  color: string;
  icon: string;
  tooltip: string;
  pulseAnimation: boolean;
}

// Terminal title bar indicators
interface TerminalTitleSecurity {
  badge: TerminalSecurityBadge;
  lockIcon: boolean;
  warningStrip: boolean;
}
```

## Implementation Points

### 1. PTY Manager Enhancement

```rust
// In pty_manager.rs
impl PtyManager {
    pub async fn create_pty_with_security(
        &self,
        terminal_id: String,
        shell: Option<String>,
        rows: u16,
        cols: u16,
        security_context: SecurityContext,
    ) -> Result<PtyHandle, OrchflowError> {
        // Validate security policy
        self.security_manager.validate_terminal_creation(&security_context)?;
        
        // Apply isolation if configured
        let isolated_env = if security_context.isolation.enabled {
            self.create_isolated_environment(&security_context.isolation)?
        } else {
            None
        };
        
        // Create PTY with security context
        let mut pty_handle = self.create_pty_internal(
            terminal_id,
            shell,
            rows,
            cols,
            isolated_env,
        ).await?;
        
        // Attach security monitors
        self.attach_security_monitors(&mut pty_handle, &security_context)?;
        
        Ok(pty_handle)
    }
}
```

### 2. Command Interceptor

```rust
// In terminal_commands.rs
#[tauri::command]
pub async fn run_command_secure(
    manager: State<'_, Manager>,
    pane_id: String,
    command: String,
    security_override: Option<SecurityOverride>,
) -> Result<Value> {
    // Get security context
    let security_context = manager.get_security_context(&pane_id).await?;
    
    // Check command against policy
    let check_result = manager.security_manager
        .check_command(&command, &security_context, security_override)?;
    
    match check_result {
        CommandCheckResult::Allow => {
            // Audit if configured
            if security_context.audit_config.enabled {
                manager.audit_logger.log_command_execution(&command, &pane_id).await?;
            }
            
            // Execute with monitoring
            manager.execute_monitored_command(pane_id, command).await
        }
        CommandCheckResult::Deny(reason) => {
            Err(OrchflowError::SecurityViolation { 
                reason,
                severity: SecuritySeverity::High,
            })
        }
        CommandCheckResult::RequireConfirmation(warning) => {
            // Return confirmation request to UI
            Ok(json!({
                "requiresConfirmation": true,
                "warning": warning,
                "command": command,
                "riskLevel": check_result.risk_level(),
            }))
        }
    }
}
```

### 3. Plugin Security Manager

```rust
// In plugin_system/security.rs
pub struct PluginSecurityManager {
    policies: HashMap<String, PluginSecurityPolicy>,
    sandbox_runtime: Box<dyn SandboxRuntime>,
    verifier: PluginVerifier,
}

impl PluginSecurityManager {
    pub async fn load_plugin_secure(
        &self,
        plugin_path: &Path,
        requested_capabilities: &[Capability],
    ) -> Result<SecurePlugin> {
        // Verify plugin signature
        self.verifier.verify_plugin(plugin_path)?;
        
        // Check requested capabilities against policy
        let policy = self.get_policy_for_plugin(plugin_path)?;
        self.validate_capabilities(requested_capabilities, &policy)?;
        
        // Create sandboxed runtime
        let sandbox = self.sandbox_runtime.create_sandbox(&policy)?;
        
        // Load plugin in sandbox
        let plugin = sandbox.load_plugin(plugin_path, requested_capabilities)?;
        
        Ok(SecurePlugin {
            plugin,
            sandbox,
            policy,
            monitor: self.create_monitor(&policy),
        })
    }
}
```

## Configuration Schema

```json
{
  "terminal": {
    "security": {
      "defaultTier": 1,
      "workspaceTrust": {
        "enabled": true,
        "requireForTerminals": true,
        "trustOnFirstUse": false
      },
      "commands": {
        "mode": "denylist",
        "auditAll": false,
        "maskCredentials": true,
        "dangerous": [
          {
            "pattern": "rm -rf /*",
            "action": "deny",
            "reason": "Dangerous recursive deletion"
          },
          {
            "pattern": "curl .* | bash",
            "action": "confirm",
            "reason": "Executing remote scripts"
          }
        ]
      },
      "isolation": {
        "enabled": false,
        "type": "process",
        "defaultLimits": {
          "maxMemoryMB": 1024,
          "maxCpuPercent": 50,
          "executionTimeoutSec": 3600
        }
      },
      "plugins": {
        "requireSignature": true,
        "sandboxMode": "capability",
        "autoApproveUpdates": false
      },
      "audit": {
        "enabled": true,
        "level": "commands",
        "retentionDays": 30,
        "excludePatterns": ["^ls", "^pwd", "^cd"]
      }
    }
  }
}
```

## Security UI Components

### 1. Security Status Bar

```svelte
<script lang="ts">
  import { terminalSecurity } from '$lib/stores/security';
  
  $: securityLevel = $terminalSecurity.level;
  $: badge = getSecurityBadge(securityLevel);
</script>

<div class="security-status" class:warning={securityLevel < 2}>
  <Icon name={badge.icon} color={badge.color} />
  <span>{badge.label}</span>
  {#if $terminalSecurity.alerts.length > 0}
    <AlertIndicator count={$terminalSecurity.alerts.length} />
  {/if}
</div>
```

### 2. Command Confirmation Dialog

```svelte
<script lang="ts">
  export let command: string;
  export let warning: SecurityWarning;
  export let onConfirm: () => void;
  export let onCancel: () => void;
</script>

<Modal title="Security Warning">
  <div class="warning-content">
    <Icon name="alert-triangle" size="large" color="warning" />
    <h3>Confirm Command Execution</h3>
    <p>{warning.message}</p>
    
    <div class="command-preview">
      <code>{command}</code>
    </div>
    
    <div class="risk-assessment">
      <RiskMeter level={warning.riskLevel} />
      <ul class="risk-factors">
        {#each warning.riskFactors as factor}
          <li>{factor}</li>
        {/each}
      </ul>
    </div>
    
    <div class="actions">
      <button on:click={onCancel}>Cancel</button>
      <button on:click={onConfirm} class="danger">
        Execute Anyway
      </button>
    </div>
  </div>
</Modal>
```

## Migration Strategy

### Phase 1: Foundation (Weeks 1-2)
- Implement security context infrastructure
- Add basic command validation
- Create security configuration schema

### Phase 2: Core Security (Weeks 3-4)
- Implement command allowlist/denylist
- Add workspace trust integration
- Create audit logging system

### Phase 3: Advanced Features (Weeks 5-6)
- Implement process isolation options
- Add plugin sandboxing
- Create security UI components

### Phase 4: Polish (Weeks 7-8)
- Performance optimization
- Security testing and hardening
- Documentation and user guides

## Performance Considerations

### Minimal Overhead Mode
- Lazy initialization of security components
- Compile-time feature flags for zero-cost abstractions
- Cached security decisions

### Optimizations
```rust
// Use const generics for compile-time security levels
impl<const LEVEL: u8> Terminal<LEVEL> {
    fn execute_command(&self, cmd: &str) -> Result<()> {
        if LEVEL > 0 {
            self.validate_command(cmd)?;
        }
        // Direct execution path for LEVEL 0
        self.raw_execute(cmd)
    }
}
```

## Testing Strategy

### Security Test Suite
1. Command injection tests
2. Path traversal tests
3. Resource exhaustion tests
4. Plugin isolation tests
5. Audit trail integrity tests

### Performance Benchmarks
- Command execution overhead per security tier
- Memory usage with isolation enabled
- Plugin sandboxing performance impact

## Future Enhancement Possibilities

1. **Machine Learning Integration**
   - Anomaly detection for unusual commands
   - Behavioral analysis for threat detection

2. **Advanced Isolation**
   - MicroVM integration (Firecracker)
   - eBPF-based system call filtering

3. **Cryptographic Protection**
   - Terminal session encryption
   - Secure credential storage
   - Hardware security module support

4. **Compliance Features**
   - GDPR audit trails
   - SOC2 compliance mode
   - Industry-specific security profiles

## Conclusion

This security design provides OrchFlow users with granular control over their terminal security posture. By implementing toggleable security tiers, we enable developers to choose the right balance between security and usability for their specific use cases, from unrestricted local development to highly secure production environments.