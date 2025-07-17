/**
 * Shared type definitions for OrchFlow
 */

export interface LaunchOptions {
  debug?: boolean;
  port?: number;
  host?: string;
  ui?: boolean;
  noCore?: boolean;
  restore?: string;
  dataDir?: string;
  config?: string;
  mode?: string;
  // Enhanced options for comprehensive setup
  autoDetect?: boolean;
  respectLayout?: boolean;
  split?: 'horizontal' | 'vertical';
  splitSize?: number;
  installDependencies?: boolean;
  configureEnvironment?: boolean;
  // Additional properties for config manager
  enablePersistence?: boolean;
  enableWebSocket?: boolean;
  storageDir?: string;
  maxWorkers?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export type WorkerStatus = 'idle' | 'running' | 'completed' | 'failed' | 'spawning' | 'error' | 'stopped';

export interface WorkerMetrics {
  id: string;
  cpuUsage: number;
  memoryUsage: number;
  tasksCompleted: number;
  averageTaskTime: number;
  successRate: number;
  uptime: number;
}

// Import unified OrchFlowConfig from unified interfaces
export type { OrchFlowConfig } from './types/unified-interfaces';

export interface PerformanceMetrics {
  setupTime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeWorkers: number;
  completedTasks: number;
  errorRate: number;
  throughput: number;
}

export interface SetupProgress {
  currentStep: string;
  totalSteps: number;
  currentStepProgress: number;
  overallProgress: number;
  estimatedTimeRemaining: number;
}

export interface DependencyStatus {
  name: string;
  required: boolean;
  installed: boolean;
  version?: string;
  installMethod?: string;
  configurationStatus: 'not-configured' | 'configured' | 'optimized';
}

export interface EnvironmentCapabilities {
  platform: string;
  terminal: string;
  hasTmux: boolean;
  tmuxVersion?: string;
  packageManagers: string[];
  canInstallDependencies: boolean;
  supportedModes: string[];
  recommendedMode: string;
}

export interface UserInteraction {
  type: 'choice' | 'confirm' | 'input' | 'progress';
  message: string;
  options?: string[];
  defaultValue?: string;
  required?: boolean;
}

export interface InstallationStep {
  name: string;
  description: string;
  required: boolean;
  duration: number;
  success: boolean;
  errorMessage?: string;
  warnings?: string[];
}

export interface TmuxConfiguration {
  orchflowBindings: boolean;
  mouseSupport: boolean;
  visualActivity: boolean;
  statusBar: boolean;
  customPrefix?: string;
  keyBindings: Record<string, string>;
  statusFormat?: string;
  sessionName?: string;
}