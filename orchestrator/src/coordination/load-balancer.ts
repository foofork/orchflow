import { Task, Agent, LoadBalancingStrategy } from './types';
import { metricsCollector } from '../metrics/metrics-collector';

// Least connections - Route to agent with fewest active tasks
export class LeastConnectionsStrategy implements LoadBalancingStrategy {
  name = 'LeastConnections';
  
  selectAgent(task: Task, agents: Agent[]): string | null {
    const eligibleAgents = agents.filter(agent => this.canHandleTask(agent, task));
    
    if (eligibleAgents.length === 0) return null;
    
    // Find agent with fewest current tasks
    const selected = eligibleAgents.reduce((least, agent) => {
      return agent.currentTasks.length < least.currentTasks.length ? agent : least;
    });
    
    return selected.id;
  }
  
  private canHandleTask(agent: Agent, task: Task): boolean {
    if (agent.status !== 'idle' || agent.health < 20) return false;
    
    if (task.agentRequirements) {
      if (task.agentRequirements.type && agent.type !== task.agentRequirements.type) {
        return false;
      }
      
      if (task.agentRequirements.capabilities) {
        const hasAll = task.agentRequirements.capabilities.every(cap =>
          agent.capabilities.includes(cap)
        );
        if (!hasAll) return false;
      }
    }
    
    return true;
  }
}

// Weighted round-robin - Consider agent capacity
export class WeightedRoundRobinStrategy implements LoadBalancingStrategy {
  name = 'WeightedRoundRobin';
  private weights: Map<string, number> = new Map();
  private currentWeights: Map<string, number> = new Map();
  
  selectAgent(task: Task, agents: Agent[]): string | null {
    const eligibleAgents = agents.filter(agent => this.canHandleTask(agent, task));
    
    if (eligibleAgents.length === 0) return null;
    
    // Initialize weights based on agent health and performance
    for (const agent of eligibleAgents) {
      if (!this.weights.has(agent.id)) {
        this.weights.set(agent.id, this.calculateWeight(agent));
        this.currentWeights.set(agent.id, 0);
      }
    }
    
    // Select agent with highest current weight
    let maxWeight = -1;
    let selected: Agent | null = null;
    
    for (const agent of eligibleAgents) {
      const weight = this.weights.get(agent.id) || 1;
      const currentWeight = this.currentWeights.get(agent.id) || 0;
      const newWeight = currentWeight + weight;
      
      this.currentWeights.set(agent.id, newWeight);
      
      if (newWeight > maxWeight) {
        maxWeight = newWeight;
        selected = agent;
      }
    }
    
    if (selected) {
      // Reset weight for selected agent
      this.currentWeights.set(selected.id, 
        (this.currentWeights.get(selected.id) || 0) - 
        this.getTotalWeight(eligibleAgents)
      );
      
      return selected.id;
    }
    
    return null;
  }
  
  private calculateWeight(agent: Agent): number {
    const healthWeight = agent.health / 100;
    const successRate = agent.completedTasks / 
      (agent.completedTasks + agent.failedTasks + 1);
    const speedWeight = agent.averageTaskTime > 0 
      ? Math.min(1, 10000 / agent.averageTaskTime) // Normalize to 0-1
      : 0.5;
    
    return Math.round((healthWeight * 0.4 + successRate * 0.4 + speedWeight * 0.2) * 10);
  }
  
  private getTotalWeight(agents: Agent[]): number {
    return agents.reduce((sum, agent) => 
      sum + (this.weights.get(agent.id) || 1), 0
    );
  }
  
  private canHandleTask(agent: Agent, task: Task): boolean {
    if (agent.status !== 'idle' || agent.health < 20) return false;
    
    if (task.agentRequirements) {
      if (task.agentRequirements.type && agent.type !== task.agentRequirements.type) {
        return false;
      }
      
      if (task.agentRequirements.capabilities) {
        const hasAll = task.agentRequirements.capabilities.every(cap =>
          agent.capabilities.includes(cap)
        );
        if (!hasAll) return false;
      }
    }
    
    return true;
  }
}

// Response time based - Route to fastest responding agent
export class ResponseTimeStrategy implements LoadBalancingStrategy {
  name = 'ResponseTime';
  private responseTimes: Map<string, number[]> = new Map();
  private readonly maxSamples = 10;
  
  selectAgent(task: Task, agents: Agent[]): string | null {
    const eligibleAgents = agents.filter(agent => this.canHandleTask(agent, task));
    
    if (eligibleAgents.length === 0) return null;
    
    // Select agent with lowest average response time
    let minResponseTime = Infinity;
    let selected: Agent | null = null;
    
    for (const agent of eligibleAgents) {
      const avgResponseTime = this.getAverageResponseTime(agent.id);
      
      if (avgResponseTime < minResponseTime) {
        minResponseTime = avgResponseTime;
        selected = agent;
      }
    }
    
    return selected ? selected.id : null;
  }
  
  recordResponseTime(agentId: string, responseTime: number): void {
    if (!this.responseTimes.has(agentId)) {
      this.responseTimes.set(agentId, []);
    }
    
    const times = this.responseTimes.get(agentId)!;
    times.push(responseTime);
    
    // Keep only recent samples
    if (times.length > this.maxSamples) {
      times.shift();
    }
    
    metricsCollector.histogram('loadbalancer.response_time', responseTime, 
      { agent: agentId }
    );
  }
  
  private getAverageResponseTime(agentId: string): number {
    const times = this.responseTimes.get(agentId);
    
    if (!times || times.length === 0) {
      return 1000; // Default 1 second
    }
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }
  
  private canHandleTask(agent: Agent, task: Task): boolean {
    if (agent.status !== 'idle' || agent.health < 20) return false;
    
    if (task.agentRequirements) {
      if (task.agentRequirements.type && agent.type !== task.agentRequirements.type) {
        return false;
      }
      
      if (task.agentRequirements.capabilities) {
        const hasAll = task.agentRequirements.capabilities.every(cap =>
          agent.capabilities.includes(cap)
        );
        if (!hasAll) return false;
      }
    }
    
    return true;
  }
}

// Hash-based routing - Consistent assignment based on task properties
export class ConsistentHashStrategy implements LoadBalancingStrategy {
  name = 'ConsistentHash';
  
  selectAgent(task: Task, agents: Agent[]): string | null {
    const eligibleAgents = agents.filter(agent => this.canHandleTask(agent, task));
    
    if (eligibleAgents.length === 0) return null;
    
    // Hash task name to consistently assign to same agent
    const hash = this.hashString(task.name + task.type);
    const index = hash % eligibleAgents.length;
    
    return eligibleAgents[index].id;
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  private canHandleTask(agent: Agent, task: Task): boolean {
    if (agent.status !== 'idle' || agent.health < 20) return false;
    
    if (task.agentRequirements) {
      if (task.agentRequirements.type && agent.type !== task.agentRequirements.type) {
        return false;
      }
      
      if (task.agentRequirements.capabilities) {
        const hasAll = task.agentRequirements.capabilities.every(cap =>
          agent.capabilities.includes(cap)
        );
        if (!hasAll) return false;
      }
    }
    
    return true;
  }
}

// Load balancer manager
export class LoadBalancer {
  private strategy: LoadBalancingStrategy;
  private strategies: Map<string, LoadBalancingStrategy> = new Map();
  
  constructor(strategy?: LoadBalancingStrategy) {
    // Register default strategies
    this.registerStrategy(new LeastConnectionsStrategy());
    this.registerStrategy(new WeightedRoundRobinStrategy());
    this.registerStrategy(new ResponseTimeStrategy());
    this.registerStrategy(new ConsistentHashStrategy());
    
    this.strategy = strategy || new LeastConnectionsStrategy();
  }
  
  registerStrategy(strategy: LoadBalancingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }
  
  setStrategy(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy) {
      this.strategy = strategy;
      console.log(`Load balancing strategy changed to: ${name}`);
    } else {
      throw new Error(`Unknown strategy: ${name}`);
    }
  }
  
  selectAgent(task: Task, agents: Agent[]): string | null {
    const timer = metricsCollector.timer('loadbalancer.selection');
    
    try {
      const selected = this.strategy.selectAgent(task, agents);
      
      if (selected) {
        metricsCollector.increment('loadbalancer.selections.success');
      } else {
        metricsCollector.increment('loadbalancer.selections.failed');
      }
      
      return selected;
    } finally {
      timer();
    }
  }
  
  recordResponseTime(agentId: string, responseTime: number): void {
    if (this.strategy instanceof ResponseTimeStrategy) {
      this.strategy.recordResponseTime(agentId, responseTime);
    }
  }
  
  getStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
  
  getCurrentStrategy(): string {
    return this.strategy.name;
  }
}