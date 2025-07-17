export interface Message {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UserPreferences {
  verbosity: 'minimal' | 'normal' | 'detailed';
  confirmActions: boolean;
  autoSuggest: boolean;
  theme: 'light' | 'dark';
}

// WorkerInfo interface moved to unified-interfaces.ts
import type { WorkerInfo } from '../types/unified-interfaces';

// Re-export WorkerInfo for backward compatibility
export type { WorkerInfo };

export class ConversationContext {
  private history: Message[] = [];
  private sessionId: string;
  private activeWorkers: Map<string, WorkerInfo> = new Map();
  private currentTask?: any;
  private userPreferences: UserPreferences = {
    verbosity: 'normal',
    confirmActions: true,
    autoSuggest: true,
    theme: 'dark'
  };
  private maxHistorySize = 100;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || this.generateSessionId();
  }

  addMessage(message: Message): void {
    this.history.push(message);

    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  getRecentHistory(count?: number): Message[] {
    const n = count || 10;
    return this.history.slice(-n);
  }

  getFullHistory(): Message[] {
    return [...this.history];
  }

  setActiveWorkers(workers: WorkerInfo[]): void {
    this.activeWorkers.clear();
    workers.forEach(worker => {
      this.activeWorkers.set(worker.id, worker);
    });
  }

  getActiveWorkers(): WorkerInfo[] {
    return Array.from(this.activeWorkers.values());
  }

  getWorkerById(id: string): WorkerInfo | undefined {
    return this.activeWorkers.get(id);
  }

  getWorkerByName(name: string): WorkerInfo | undefined {
    for (const worker of this.activeWorkers.values()) {
      if (worker.descriptiveName.toLowerCase().includes(name.toLowerCase())) {
        return worker;
      }
    }
    return undefined;
  }

  setCurrentTask(task: any): void {
    this.currentTask = task;
  }

  getCurrentTask(): any {
    return this.currentTask;
  }

  updateUserPreferences(prefs: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...prefs };
  }

  getUserPreferences(): UserPreferences {
    return { ...this.userPreferences };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  export(): any {
    return {
      sessionId: this.sessionId,
      history: this.history,
      activeWorkers: Array.from(this.activeWorkers.entries()),
      currentTask: this.currentTask,
      userPreferences: this.userPreferences
    };
  }

  restore(data: any): void {
    if (data.sessionId) {this.sessionId = data.sessionId;}
    if (data.history) {this.history = data.history;}
    if (data.activeWorkers) {
      this.activeWorkers.clear();
      data.activeWorkers.forEach(([id, worker]: [string, WorkerInfo]) => {
        this.activeWorkers.set(id, worker);
      });
    }
    if (data.currentTask) {this.currentTask = data.currentTask;}
    if (data.userPreferences) {this.userPreferences = data.userPreferences;}
  }

  clear(): void {
    this.history = [];
    this.activeWorkers.clear();
    this.currentTask = undefined;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  switchContext(workerId: string): void {
    // Switch the conversation context to a specific worker
    const worker = this.activeWorkers.get(workerId);
    if (worker) {
      this.addMessage({
        type: 'system',
        content: `Switched context to worker: ${worker.descriptiveName}`,
        timestamp: new Date(),
        metadata: { workerId }
      });
    }
  }

  // Context analysis methods
  getLastUserMessage(): Message | undefined {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].type === 'user') {
        return this.history[i];
      }
    }
    return undefined;
  }

  getLastAssistantMessage(): Message | undefined {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].type === 'assistant') {
        return this.history[i];
      }
    }
    return undefined;
  }

  isWaitingForResponse(): boolean {
    if (this.history.length === 0) {return false;}
    return this.history[this.history.length - 1].type === 'user';
  }

  getConversationDuration(): number {
    if (this.history.length === 0) {return 0;}
    const firstMessage = this.history[0];
    const lastMessage = this.history[this.history.length - 1];
    return lastMessage.timestamp.getTime() - firstMessage.timestamp.getTime();
  }
}