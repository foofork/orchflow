import { Task, Agent, SchedulingStrategy, TaskAssignment } from './types';

// FIFO (First In, First Out) - Simple queue-based scheduling
export class FIFOStrategy implements SchedulingStrategy {
  name = 'FIFO';
  
  schedule(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];
    const availableAgents = [...agents];
    
    for (const task of tasks) {
      if (availableAgents.length === 0) break;
      
      const agent = this.selectAgent(task, availableAgents);
      if (agent) {
        assignments.push({
          taskId: task.id,
          agentId: agent.id,
          estimatedStartTime: new Date(),
          priority: task.priority,
        });
        
        // Remove agent from available pool
        const index = availableAgents.indexOf(agent);
        availableAgents.splice(index, 1);
      }
    }
    
    return assignments;
  }
  
  private selectAgent(task: Task, agents: Agent[]): Agent | null {
    // Find first matching agent
    for (const agent of agents) {
      if (this.canHandleTask(agent, task)) {
        return agent;
      }
    }
    return null;
  }
  
  private canHandleTask(agent: Agent, task: Task): boolean {
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

// Priority-based scheduling - Higher priority tasks first
export class PriorityStrategy implements SchedulingStrategy {
  name = 'Priority';
  
  schedule(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];
    const availableAgents = [...agents];
    
    // Sort tasks by priority (descending)
    const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);
    
    for (const task of sortedTasks) {
      if (availableAgents.length === 0) break;
      
      const agent = this.selectBestAgent(task, availableAgents);
      if (agent) {
        assignments.push({
          taskId: task.id,
          agentId: agent.id,
          estimatedStartTime: new Date(),
          priority: task.priority,
        });
        
        const index = availableAgents.indexOf(agent);
        availableAgents.splice(index, 1);
      }
    }
    
    return assignments;
  }
  
  private selectBestAgent(task: Task, agents: Agent[]): Agent | null {
    const eligibleAgents = agents.filter(agent => this.canHandleTask(agent, task));
    
    if (eligibleAgents.length === 0) return null;
    
    // Select agent with best performance
    return eligibleAgents.reduce((best, agent) => {
      const bestScore = this.calculateAgentScore(best);
      const agentScore = this.calculateAgentScore(agent);
      return agentScore > bestScore ? agent : best;
    });
  }
  
  private calculateAgentScore(agent: Agent): number {
    const successRate = agent.completedTasks / 
      (agent.completedTasks + agent.failedTasks + 1);
    const healthScore = agent.health / 100;
    const speedScore = agent.averageTaskTime > 0 ? 1 / agent.averageTaskTime : 1;
    
    return successRate * 0.4 + healthScore * 0.3 + speedScore * 0.3;
  }
  
  private canHandleTask(agent: Agent, task: Task): boolean {
    if (agent.health < 20) return false; // Skip unhealthy agents
    
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

// Round-robin scheduling - Distribute tasks evenly
export class RoundRobinStrategy implements SchedulingStrategy {
  name = 'RoundRobin';
  private lastAssignedIndex = 0;
  
  schedule(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];
    const eligibleAgents = agents.filter(a => a.health > 20);
    
    if (eligibleAgents.length === 0) return assignments;
    
    for (const task of tasks) {
      const agent = this.getNextAgent(task, eligibleAgents);
      if (agent) {
        assignments.push({
          taskId: task.id,
          agentId: agent.id,
          estimatedStartTime: new Date(),
          priority: task.priority,
        });
      }
    }
    
    return assignments;
  }
  
  private getNextAgent(task: Task, agents: Agent[]): Agent | null {
    const startIndex = this.lastAssignedIndex;
    
    // Try to find suitable agent starting from last position
    for (let i = 0; i < agents.length; i++) {
      const index = (startIndex + i) % agents.length;
      const agent = agents[index];
      
      if (this.canHandleTask(agent, task)) {
        this.lastAssignedIndex = (index + 1) % agents.length;
        return agent;
      }
    }
    
    return null;
  }
  
  private canHandleTask(agent: Agent, task: Task): boolean {
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

// Shortest Job First - Schedule quick tasks first
export class ShortestJobFirstStrategy implements SchedulingStrategy {
  name = 'ShortestJobFirst';
  
  schedule(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];
    const availableAgents = [...agents];
    
    // Sort tasks by estimated duration (using timeout as proxy)
    const sortedTasks = [...tasks].sort((a, b) => {
      const aDuration = a.timeout || Number.MAX_SAFE_INTEGER;
      const bDuration = b.timeout || Number.MAX_SAFE_INTEGER;
      return aDuration - bDuration;
    });
    
    for (const task of sortedTasks) {
      if (availableAgents.length === 0) break;
      
      const agent = this.selectFastestAgent(task, availableAgents);
      if (agent) {
        assignments.push({
          taskId: task.id,
          agentId: agent.id,
          estimatedStartTime: new Date(),
          priority: task.priority,
        });
        
        const index = availableAgents.indexOf(agent);
        availableAgents.splice(index, 1);
      }
    }
    
    return assignments;
  }
  
  private selectFastestAgent(task: Task, agents: Agent[]): Agent | null {
    const eligibleAgents = agents.filter(agent => this.canHandleTask(agent, task));
    
    if (eligibleAgents.length === 0) return null;
    
    // Select agent with lowest average task time
    return eligibleAgents.reduce((fastest, agent) => {
      return agent.averageTaskTime < fastest.averageTaskTime ? agent : fastest;
    });
  }
  
  private canHandleTask(agent: Agent, task: Task): boolean {
    if (agent.health < 20) return false;
    
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