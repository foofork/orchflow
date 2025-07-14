import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

// Types matching the Rust security structures
export enum SecurityTier {
  Unrestricted = 0,
  Basic = 1,
  Enhanced = 2,
  Restricted = 3,
  Isolated = 4
}

export interface SecurityContext {
  tier: SecurityTier;
  commandPolicy: CommandSecurityPolicy;
  isolation: ProcessIsolationConfig;
  workspaceTrust: WorkspaceTrustConfig;
  auditConfig: AuditConfig;
  alerts?: SecurityAlert[];
}

export interface CommandSecurityPolicy {
  mode: 'Unrestricted' | 'AllowlistOnly' | 'DenylistFilter' | 'Interactive';
  auditCommands: boolean;
  maskSensitiveArgs: boolean;
}

export interface ProcessIsolationConfig {
  enabled: boolean;
  isolationType: 'None' | 'ProcessNamespace' | 'Container' | 'VM';
  resourceLimits: ResourceLimits;
}

export interface ResourceLimits {
  maxMemoryMb?: number;
  maxCpuPercent?: number;
  maxProcesses?: number;
  maxOpenFiles?: number;
  executionTimeoutSec?: number;
}

export interface WorkspaceTrustConfig {
  enabled: boolean;
  trustOnFirstUse: boolean;
  trustedPaths: string[];
  parentFolderTrust: boolean;
  untrustedRestrictions: UntrustedRestrictions;
}

export interface UntrustedRestrictions {
  disableTaskRunning: boolean;
  disableDebugging: boolean;
  disableTerminalCreation: boolean;
  restrictTerminalCommands: boolean;
  disableWorkspaceExtensions: boolean;
}

export interface AuditConfig {
  enabled: boolean;
  logLevel: 'CommandsOnly' | 'CommandsAndOutput' | 'Full';
  retentionDays: number;
  encryptLogs: boolean;
  excludePatterns: string[];
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  terminalId?: string;
  actionRequired?: boolean;
}

export interface CommandCheckResult {
  allow: boolean;
  requiresConfirmation?: boolean;
  warning?: SecurityWarning;
  reason?: string;
}

export interface SecurityWarning {
  message: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  riskFactors: string[];
  matchedPattern?: string;
}

// Store for terminal security contexts
const terminalContexts = writable<Record<string, SecurityContext>>({});

// Store for global security settings
const globalSecuritySettings = writable<{
  defaultTier: SecurityTier;
  workspaceTrustEnabled: boolean;
  auditingEnabled: boolean;
  alerts: SecurityAlert[];
}>({
  defaultTier: SecurityTier.Basic,
  workspaceTrustEnabled: true,
  auditingEnabled: false,
  alerts: []
});

// Derived store for current security status
export const securityStatus = derived(
  [terminalContexts, globalSecuritySettings],
  ([$contexts, $settings]) => {
    const terminalCount = Object.keys($contexts).length;
    const activeTiers = new Set(Object.values($contexts).map(c => c.tier));
    const highestTier = Math.max(...Array.from(activeTiers), 0);
    const hasAlerts = $settings.alerts.some(a => a.actionRequired);
    
    return {
      terminalCount,
      activeTiers: Array.from(activeTiers),
      highestTier,
      hasAlerts,
      alertCount: $settings.alerts.length
    };
  }
);

// Terminal security API
export const terminalSecurity = {
  // Initialize security for a terminal
  async initializeTerminal(
    terminalId: string,
    workspacePath?: string,
    overrideTier?: SecurityTier
  ): Promise<SecurityContext> {
    try {
      const context = await invoke<SecurityContext>('create_terminal_security_context', {
        terminalId,
        workspacePath,
        overrideTier
      });
      
      terminalContexts.update(contexts => ({
        ...contexts,
        [terminalId]: context
      }));
      
      return context;
    } catch (error) {
      console.error('Failed to initialize terminal security:', error);
      throw error;
    }
  },
  
  // Check if a command is allowed
  async checkCommand(
    terminalId: string,
    command: string,
    workingDir?: string
  ): Promise<CommandCheckResult> {
    try {
      const result = await invoke<CommandCheckResult>('check_terminal_command', {
        terminalId,
        command,
        workingDir
      });
      
      // Update alerts if command was blocked
      if (!result.allow && result.reason) {
        const alert: SecurityAlert = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          severity: 'warning',
          message: `Command blocked: ${result.reason}`,
          terminalId,
          actionRequired: false
        };
        
        globalSecuritySettings.update(settings => ({
          ...settings,
          alerts: [...settings.alerts, alert]
        }));
      }
      
      return result;
    } catch (error) {
      console.error('Failed to check command:', error);
      throw error;
    }
  },
  
  // Update security tier for a terminal
  async updateTerminalTier(terminalId: string, newTier: SecurityTier): Promise<void> {
    try {
      await invoke('update_terminal_security_tier', {
        terminalId,
        tier: newTier
      });
      
      terminalContexts.update(contexts => {
        if (contexts[terminalId]) {
          contexts[terminalId].tier = newTier;
        }
        return contexts;
      });
    } catch (error) {
      console.error('Failed to update terminal tier:', error);
      throw error;
    }
  },
  
  // Trust a workspace
  async trustWorkspace(workspacePath: string): Promise<void> {
    try {
      await invoke('trust_workspace', {
        workspacePath
      });
      
      // Add success alert
      const alert: SecurityAlert = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        severity: 'info',
        message: `Workspace trusted: ${workspacePath}`,
        actionRequired: false
      };
      
      globalSecuritySettings.update(settings => ({
        ...settings,
        alerts: [...settings.alerts, alert]
      }));
    } catch (error) {
      console.error('Failed to trust workspace:', error);
      throw error;
    }
  },
  
  // Get audit logs
  async getAuditLogs(filter?: {
    startTime?: Date;
    endTime?: Date;
    terminalId?: string;
    eventTypes?: string[];
  }): Promise<AuditEvent[]> {
    try {
      return await invoke<AuditEvent[]>('get_security_audit_logs', {
        filter
      });
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw error;
    }
  },
  
  // Clear security alerts
  clearAlerts(terminalId?: string): void {
    globalSecuritySettings.update(settings => ({
      ...settings,
      alerts: terminalId
        ? settings.alerts.filter(a => a.terminalId !== terminalId)
        : []
    }));
  },
  
  // Update global settings
  updateGlobalSettings(updates: Partial<{
    defaultTier: SecurityTier;
    workspaceTrustEnabled: boolean;
    auditingEnabled: boolean;
  }>): void {
    globalSecuritySettings.update(settings => ({
      ...settings,
      ...updates
    }));
  },
  
  // Subscribe to security events
  subscribeToSecurityEvents(): () => void {
    // Import and use the security event manager
    import('$lib/services/securityEvents').then(({ securityEventManager, enableAutoConnect }) => {
      // Enable auto-connection if not already connected
      enableAutoConnect();
      
      // Subscribe to security events
      return securityEventManager.subscribe((event) => {
        // Handle security events in the context of terminal security
        if (event.type === 'alert' && event.terminalId) {
          terminalContexts.update(contexts => {
            const context = contexts[event.terminalId!];
            if (context) {
              const alert: SecurityAlert = {
                id: crypto.randomUUID(),
                timestamp: new Date(event.timestamp),
                severity: event.severity,
                message: event.data.message || 'Security event received',
                terminalId: event.terminalId,
                actionRequired: event.severity === 'critical' || event.severity === 'error'
              };
              
              context.alerts = [...(context.alerts || []), alert];
            }
            return contexts;
          });
        }
      });
    }).catch(error => {
      console.error('Failed to subscribe to security events:', error);
    });

    return () => {
      // Cleanup handled by the security event manager
    };
  },
  
  // Export security configuration
  async exportSecurityConfig(): Promise<string> {
    try {
      const config = await invoke<string>('export_security_configuration');
      return config;
    } catch (error) {
      console.error('Failed to export security config:', error);
      throw error;
    }
  },
  
  // Import security configuration
  async importSecurityConfig(configJson: string): Promise<void> {
    try {
      await invoke('import_security_configuration', {
        configJson
      });
      
      // Reload all terminal contexts
      const terminals = Object.keys(get(terminalContexts));
      for (const terminalId of terminals) {
        await this.initializeTerminal(terminalId);
      }
    } catch (error) {
      console.error('Failed to import security config:', error);
      throw error;
    }
  }
};

// Audit event type
export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  user: string;
  sessionId: string;
  terminalId?: string;
  command?: string;
  workingDir?: string;
  riskScore: number;
  outcome: 'Success' | 'Denied' | 'Failed' | 'RequiresConfirmation';
  details?: any;
}

// Export stores and API
export {
  terminalContexts as terminalSecurityStore,
  globalSecuritySettings
};