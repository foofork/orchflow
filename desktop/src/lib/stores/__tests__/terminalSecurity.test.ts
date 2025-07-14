import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { createAsyncMock, createAsyncVoidMock, createTypedMock } from '@/test/mock-factory';

// Mock Tauri API before any imports that use it
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

// Import types before store
import type { 
  SecurityContext, 
  CommandCheckResult, 
  SecurityAlert, 
  AuditEvent,
  SecurityTier,
  CommandSecurityPolicy,
  ProcessIsolationConfig,
  WorkspaceTrustConfig,
  AuditConfig,
  ResourceLimits,
  UntrustedRestrictions,
  SecurityWarning
} from '../terminalSecurity';

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn();
Object.defineProperty(global.crypto, 'randomUUID', {
  value: mockRandomUUID,
  writable: true,
  configurable: true
});

// Get mock invoke function
import { invoke } from '@tauri-apps/api/core';
const mockInvoke = invoke as ReturnType<typeof createAsyncMock>;

// Import after mocking
import { 
  terminalSecurity, 
  terminalSecurityStore, 
  globalSecuritySettings,
  securityStatus,
  SecurityTier as ImportedSecurityTier
} from '../terminalSecurity';

describe('Terminal Security Store', () => {
  const cleanup: Array<() => void> = [];

  // Test data builders
  const buildSecurityContext = (overrides?: Partial<SecurityContext>): SecurityContext => ({
    tier: ImportedSecurityTier.Basic,
    commandPolicy: {
      mode: 'AllowlistOnly',
      auditCommands: true,
      maskSensitiveArgs: true
    },
    isolation: {
      enabled: false,
      isolationType: 'None',
      resourceLimits: {}
    },
    workspaceTrust: {
      enabled: true,
      trustOnFirstUse: false,
      trustedPaths: [],
      parentFolderTrust: false,
      untrustedRestrictions: {
        disableTaskRunning: true,
        disableDebugging: true,
        disableTerminalCreation: false,
        restrictTerminalCommands: true,
        disableWorkspaceExtensions: true
      }
    },
    auditConfig: {
      enabled: true,
      logLevel: 'CommandsOnly',
      retentionDays: 30,
      encryptLogs: false,
      excludePatterns: []
    },
    ...overrides
  });

  const buildCommandCheckResult = (overrides?: Partial<CommandCheckResult>): CommandCheckResult => ({
    allow: true,
    ...overrides
  });

  const buildSecurityAlert = (overrides?: Partial<SecurityAlert>): SecurityAlert => ({
    id: 'test-alert-1',
    timestamp: new Date(),
    severity: 'info',
    message: 'Test alert',
    actionRequired: false,
    ...overrides
  });

  const buildAuditEvent = (overrides?: Partial<AuditEvent>): AuditEvent => ({
    id: 'test-audit-1',
    timestamp: new Date(),
    eventType: 'CommandExecuted',
    user: 'test-user',
    sessionId: 'test-session',
    riskScore: 0,
    outcome: 'Success',
    ...overrides
  });

  beforeEach(() => {
    // Reset mocks
    mockInvoke.mockReset();
    mockRandomUUID.mockReturnValue('test-uuid');
    
    // Reset stores
    terminalSecurityStore.set({});
    globalSecuritySettings.set({
      defaultTier: ImportedSecurityTier.Basic,
      workspaceTrustEnabled: true,
      auditingEnabled: false,
      alerts: []
    });
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup.length = 0;
    vi.clearAllMocks();
  });

  describe('initializeTerminal', () => {
    it('should create security context for a terminal', async () => {
      const context = buildSecurityContext({ tier: ImportedSecurityTier.Enhanced });
      mockInvoke.mockResolvedValue(context);

      const result = await terminalSecurity.initializeTerminal('terminal-1', '/workspace', ImportedSecurityTier.Enhanced);

      expect(mockInvoke).toHaveBeenCalledWith('create_terminal_security_context', {
        terminalId: 'terminal-1',
        workspacePath: '/workspace',
        overrideTier: ImportedSecurityTier.Enhanced
      });
      expect(result).toEqual(context);
      
      const contexts = get(terminalSecurityStore);
      expect(contexts['terminal-1']).toEqual(context);
    });

    it('should use default tier when not specified', async () => {
      const context = buildSecurityContext();
      mockInvoke.mockResolvedValue(context);

      await terminalSecurity.initializeTerminal('terminal-1');

      expect(mockInvoke).toHaveBeenCalledWith('create_terminal_security_context', {
        terminalId: 'terminal-1',
        workspacePath: undefined,
        overrideTier: undefined
      });
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Failed to initialize');
      mockInvoke.mockRejectedValue(error);
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleErrorSpy.mockRestore());

      await expect(terminalSecurity.initializeTerminal('terminal-1')).rejects.toThrow('Failed to initialize');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize terminal security:', error);
    });
  });

  describe('checkCommand', () => {
    it('should allow permitted commands', async () => {
      const result = buildCommandCheckResult({ allow: true });
      mockInvoke.mockResolvedValue(result);

      const checkResult = await terminalSecurity.checkCommand('terminal-1', 'ls -la', '/home');

      expect(mockInvoke).toHaveBeenCalledWith('check_terminal_command', {
        terminalId: 'terminal-1',
        command: 'ls -la',
        workingDir: '/home'
      });
      expect(checkResult).toEqual(result);
      
      // Should not create alert for allowed commands
      const settings = get(globalSecuritySettings);
      expect(settings.alerts).toHaveLength(0);
    });

    it('should block dangerous commands and create alert', async () => {
      const result = buildCommandCheckResult({ 
        allow: false, 
        reason: 'Command contains dangerous pattern',
        warning: {
          message: 'Attempting to delete system files',
          riskLevel: 'Critical',
          riskFactors: ['rm -rf', 'system directory'],
          matchedPattern: 'rm -rf /*'
        }
      });
      mockInvoke.mockResolvedValue(result);

      const checkResult = await terminalSecurity.checkCommand('terminal-1', 'rm -rf /*');

      expect(checkResult).toEqual(result);
      
      // Should create alert for blocked command
      const settings = get(globalSecuritySettings);
      expect(settings.alerts).toHaveLength(1);
      expect(settings.alerts[0]).toMatchObject({
        id: 'test-uuid',
        severity: 'warning',
        message: 'Command blocked: Command contains dangerous pattern',
        terminalId: 'terminal-1',
        actionRequired: false
      });
    });

    it('should handle command check errors', async () => {
      const error = new Error('Check failed');
      mockInvoke.mockRejectedValue(error);
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleErrorSpy.mockRestore());

      await expect(terminalSecurity.checkCommand('terminal-1', 'test')).rejects.toThrow('Check failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to check command:', error);
    });

    it('should handle commands requiring confirmation', async () => {
      const result = buildCommandCheckResult({
        allow: true,
        requiresConfirmation: true,
        warning: {
          message: 'This command will modify system settings',
          riskLevel: 'Medium',
          riskFactors: ['system modification'],
          matchedPattern: undefined
        }
      });
      mockInvoke.mockResolvedValue(result);

      const checkResult = await terminalSecurity.checkCommand('terminal-1', 'sudo apt update');

      expect(checkResult.requiresConfirmation).toBe(true);
      expect(checkResult.warning).toBeDefined();
    });
  });

  describe('updateTerminalTier', () => {
    it('should update security tier for terminal', async () => {
      // Initialize terminal first
      const context = buildSecurityContext({ tier: ImportedSecurityTier.Basic });
      terminalSecurityStore.update(contexts => ({
        ...contexts,
        'terminal-1': context
      }));

      mockInvoke.mockResolvedValue(undefined);

      await terminalSecurity.updateTerminalTier('terminal-1', ImportedSecurityTier.Restricted);

      expect(mockInvoke).toHaveBeenCalledWith('update_terminal_security_tier', {
        terminalId: 'terminal-1',
        tier: ImportedSecurityTier.Restricted
      });

      const contexts = get(terminalSecurityStore);
      expect(contexts['terminal-1'].tier).toBe(ImportedSecurityTier.Restricted);
    });

    it('should handle tier update errors', async () => {
      const error = new Error('Update failed');
      mockInvoke.mockRejectedValue(error);
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleErrorSpy.mockRestore());

      await expect(terminalSecurity.updateTerminalTier('terminal-1', ImportedSecurityTier.Isolated)).rejects.toThrow('Update failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update terminal tier:', error);
    });
  });

  describe('trustWorkspace', () => {
    it('should trust a workspace and create success alert', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await terminalSecurity.trustWorkspace('/my/workspace');

      expect(mockInvoke).toHaveBeenCalledWith('trust_workspace', {
        workspacePath: '/my/workspace'
      });

      const settings = get(globalSecuritySettings);
      expect(settings.alerts).toHaveLength(1);
      expect(settings.alerts[0]).toMatchObject({
        id: 'test-uuid',
        severity: 'info',
        message: 'Workspace trusted: /my/workspace',
        actionRequired: false
      });
    });

    it('should handle workspace trust errors', async () => {
      const error = new Error('Trust failed');
      mockInvoke.mockRejectedValue(error);
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleErrorSpy.mockRestore());

      await expect(terminalSecurity.trustWorkspace('/untrusted')).rejects.toThrow('Trust failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to trust workspace:', error);
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with filter', async () => {
      const logs = [
        buildAuditEvent({ id: 'audit-1', command: 'ls' }),
        buildAuditEvent({ id: 'audit-2', command: 'pwd' })
      ];
      mockInvoke.mockResolvedValue(logs);

      const result = await terminalSecurity.getAuditLogs({
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-01-31'),
        terminalId: 'terminal-1',
        eventTypes: ['CommandExecuted']
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_security_audit_logs', {
        filter: {
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-31'),
          terminalId: 'terminal-1',
          eventTypes: ['CommandExecuted']
        }
      });
      expect(result).toEqual(logs);
    });

    it('should retrieve all logs without filter', async () => {
      const logs = [buildAuditEvent()];
      mockInvoke.mockResolvedValue(logs);

      const result = await terminalSecurity.getAuditLogs();

      expect(mockInvoke).toHaveBeenCalledWith('get_security_audit_logs', {
        filter: undefined
      });
      expect(result).toEqual(logs);
    });

    it('should handle audit log retrieval errors', async () => {
      const error = new Error('Retrieval failed');
      mockInvoke.mockRejectedValue(error);
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleErrorSpy.mockRestore());

      await expect(terminalSecurity.getAuditLogs()).rejects.toThrow('Retrieval failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to get audit logs:', error);
    });
  });

  describe('clearAlerts', () => {
    it('should clear all alerts', () => {
      // Add some alerts
      globalSecuritySettings.update(settings => ({
        ...settings,
        alerts: [
          buildSecurityAlert({ id: '1', terminalId: 'terminal-1' }),
          buildSecurityAlert({ id: '2', terminalId: 'terminal-2' }),
          buildSecurityAlert({ id: '3', terminalId: 'terminal-1' })
        ]
      }));

      terminalSecurity.clearAlerts();

      const settings = get(globalSecuritySettings);
      expect(settings.alerts).toHaveLength(0);
    });

    it('should clear alerts for specific terminal', () => {
      // Add alerts for multiple terminals
      globalSecuritySettings.update(settings => ({
        ...settings,
        alerts: [
          buildSecurityAlert({ id: '1', terminalId: 'terminal-1' }),
          buildSecurityAlert({ id: '2', terminalId: 'terminal-2' }),
          buildSecurityAlert({ id: '3', terminalId: 'terminal-1' })
        ]
      }));

      terminalSecurity.clearAlerts('terminal-1');

      const settings = get(globalSecuritySettings);
      expect(settings.alerts).toHaveLength(1);
      expect(settings.alerts[0].terminalId).toBe('terminal-2');
    });
  });

  describe('updateGlobalSettings', () => {
    it('should update global security settings', () => {
      terminalSecurity.updateGlobalSettings({
        defaultTier: ImportedSecurityTier.Enhanced,
        workspaceTrustEnabled: false,
        auditingEnabled: true
      });

      const settings = get(globalSecuritySettings);
      expect(settings.defaultTier).toBe(ImportedSecurityTier.Enhanced);
      expect(settings.workspaceTrustEnabled).toBe(false);
      expect(settings.auditingEnabled).toBe(true);
    });

    it('should partially update settings', () => {
      const initialSettings = get(globalSecuritySettings);
      
      terminalSecurity.updateGlobalSettings({
        auditingEnabled: true
      });

      const settings = get(globalSecuritySettings);
      expect(settings.defaultTier).toBe(initialSettings.defaultTier);
      expect(settings.workspaceTrustEnabled).toBe(initialSettings.workspaceTrustEnabled);
      expect(settings.auditingEnabled).toBe(true);
    });
  });

  describe('exportSecurityConfig', () => {
    it('should export security configuration', async () => {
      const configJson = '{"defaultTier": 1, "workspaceTrust": true}';
      mockInvoke.mockResolvedValue(configJson);

      const result = await terminalSecurity.exportSecurityConfig();

      expect(mockInvoke).toHaveBeenCalledWith('export_security_configuration');
      expect(result).toBe(configJson);
    });

    it('should handle export errors', async () => {
      const error = new Error('Export failed');
      mockInvoke.mockRejectedValue(error);
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleErrorSpy.mockRestore());

      await expect(terminalSecurity.exportSecurityConfig()).rejects.toThrow('Export failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to export security config:', error);
    });
  });

  describe('importSecurityConfig', () => {
    it('should import security configuration and reload terminals', async () => {
      // Set up existing terminals
      terminalSecurityStore.set({
        'terminal-1': buildSecurityContext(),
        'terminal-2': buildSecurityContext()
      });

      const configJson = '{"defaultTier": 2}';
      mockInvoke.mockResolvedValue(undefined);

      // Mock initializeTerminal calls
      const newContext = buildSecurityContext({ tier: ImportedSecurityTier.Enhanced });
      mockInvoke
        .mockResolvedValueOnce(undefined) // import call
        .mockResolvedValueOnce(newContext) // first terminal reload
        .mockResolvedValueOnce(newContext); // second terminal reload

      await terminalSecurity.importSecurityConfig(configJson);

      expect(mockInvoke).toHaveBeenCalledWith('import_security_configuration', {
        configJson
      });
      
      // Should reload all terminals
      expect(mockInvoke).toHaveBeenCalledWith('create_terminal_security_context', {
        terminalId: 'terminal-1',
        workspacePath: undefined,
        overrideTier: undefined
      });
      expect(mockInvoke).toHaveBeenCalledWith('create_terminal_security_context', {
        terminalId: 'terminal-2',
        workspacePath: undefined,
        overrideTier: undefined
      });
    });

    it('should handle import errors', async () => {
      const error = new Error('Import failed');
      mockInvoke.mockRejectedValue(error);
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleErrorSpy.mockRestore());

      await expect(terminalSecurity.importSecurityConfig('{}')).rejects.toThrow('Import failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to import security config:', error);
    });
  });

  describe('securityStatus derived store', () => {
    it('should calculate security status from contexts and settings', () => {
      // Add some terminal contexts
      terminalSecurityStore.set({
        'terminal-1': buildSecurityContext({ tier: ImportedSecurityTier.Basic }),
        'terminal-2': buildSecurityContext({ tier: ImportedSecurityTier.Enhanced }),
        'terminal-3': buildSecurityContext({ tier: ImportedSecurityTier.Restricted })
      });

      // Add some alerts
      globalSecuritySettings.update(settings => ({
        ...settings,
        alerts: [
          buildSecurityAlert({ actionRequired: true }),
          buildSecurityAlert({ actionRequired: false })
        ]
      }));

      const status = get(securityStatus);
      expect(status.terminalCount).toBe(3);
      expect(status.activeTiers).toContain(ImportedSecurityTier.Basic);
      expect(status.activeTiers).toContain(ImportedSecurityTier.Enhanced);
      expect(status.activeTiers).toContain(ImportedSecurityTier.Restricted);
      expect(status.highestTier).toBe(ImportedSecurityTier.Restricted);
      expect(status.hasAlerts).toBe(true);
      expect(status.alertCount).toBe(2);
    });

    it('should handle empty state', () => {
      const status = get(securityStatus);
      expect(status.terminalCount).toBe(0);
      expect(status.activeTiers).toEqual([]);
      expect(status.highestTier).toBe(0);
      expect(status.hasAlerts).toBe(false);
      expect(status.alertCount).toBe(0);
    });

    it('should update reactively when terminals change', () => {
      let status = get(securityStatus);
      expect(status.terminalCount).toBe(0);

      // Add a terminal
      terminalSecurityStore.update(contexts => ({
        ...contexts,
        'terminal-1': buildSecurityContext({ tier: ImportedSecurityTier.Isolated })
      }));

      status = get(securityStatus);
      expect(status.terminalCount).toBe(1);
      expect(status.highestTier).toBe(ImportedSecurityTier.Isolated);
    });
  });

  describe('subscribeToSecurityEvents', () => {
    it('should handle security event subscription errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleErrorSpy.mockRestore());

      // Mock the dynamic import to fail
      vi.doMock('$lib/services/securityEvents', () => {
        throw new Error('Module not found');
      });

      const unsubscribe = terminalSecurity.subscribeToSecurityEvents();
      
      // Wait for the async import to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to subscribe to security events:', expect.any(Error));
      
      // Cleanup should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});