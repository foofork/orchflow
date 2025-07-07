// Coordination types for OrchFlow

export interface Task {
  id: string;
  name: string;
  type: string;
  priority: number;
  dependencies: string[]; // Task IDs
  agentRequirements?: {
    type?: string;
    capabilities?: string[];
    minCount?: number;
    maxCount?: number;
  };
  payload: any;
  status: 'pending' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  assignedTo?: string[]; // Agent IDs
  result?: any;
  error?: string;
  retries: number;
  maxRetries: number;
  timeout?: number;
}

export interface Agent {
  id: string;
  type: string;
  capabilities: string[];
  status: 'idle' | 'busy' | 'offline';
  currentTasks: string[];
  completedTasks: number;
  failedTasks: number;
  averageTaskTime: number;
  lastTaskTime?: Date;
  health: number; // 0-100
}

export interface SchedulingStrategy {
  name: string;
  schedule(tasks: Task[], agents: Agent[]): TaskAssignment[];
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  estimatedStartTime: Date;
  priority: number;
}

export interface LoadBalancingStrategy {
  name: string;
  selectAgent(task: Task, agents: Agent[]): string | null;
}

export interface CoordinationMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  agentUtilization: Map<string, number>;
  taskThroughput: number; // tasks per minute
}