import { EventEmitter } from 'events';
import type { TmuxBackend } from '../tmux-integration/tmux-backend';
import type {
  ExtendedWorker,
  WorkerAccessSession,
  WorkerSearchResult
} from '../types/unified-interfaces';
import {
  Worker
} from '../types/unified-interfaces';

// WorkerSearchResult is now imported from unified interfaces

export class AdvancedWorkerAccess extends EventEmitter {
  private tmux: TmuxBackend;
  private activeSessions: Map<string, WorkerAccessSession> = new Map();
  private workerRegistry: Map<string, ExtendedWorker> = new Map();
  private quickKeyMap: Map<number, string> = new Map(); // key -> workerId
  private searchHistory: string[] = [];

  constructor(tmux: TmuxBackend) {
    super();
    this.tmux = tmux;
  }

  registerWorker(worker: ExtendedWorker): void {
    this.workerRegistry.set(worker.id, worker);

    if (worker.quickAccessKey) {
      this.quickKeyMap.set(worker.quickAccessKey, worker.id);
    }

    this.emit('workerRegistered', worker);
  }

  unregisterWorker(workerId: string): void {
    const worker = this.workerRegistry.get(workerId);
    if (worker?.quickAccessKey) {
      this.quickKeyMap.delete(worker.quickAccessKey);
    }

    this.workerRegistry.delete(workerId);
    this.activeSessions.delete(workerId);

    this.emit('workerUnregistered', workerId);
  }

  /**
   * Smart worker search with fuzzy matching and confidence scoring
   */
  findWorkers(query: string, limit: number = 5): WorkerSearchResult[] {
    const results: WorkerSearchResult[] = [];
    const workers = Array.from(this.workerRegistry.values());

    // Check for numeric quick access
    const numericMatch = query.match(/^(\d)$/);
    if (numericMatch) {
      const key = parseInt(numericMatch[1]);
      const workerId = this.quickKeyMap.get(key);
      if (workerId) {
        const worker = this.workerRegistry.get(workerId);
        if (worker) {
          results.push({
            worker,
            confidence: 1.0,
            matchType: 'numeric',
            matchField: 'quickKey'
          });
        }
      }
    }

    // Search by name and description
    const queryLower = query.toLowerCase();

    for (const worker of workers) {
      const name = worker.descriptiveName?.toLowerCase() || '';
      const description = typeof worker.currentTask === 'string' 
        ? worker.currentTask.toLowerCase() 
        : worker.currentTask?.description?.toLowerCase() || '';

      // Exact name match
      if (name === queryLower) {
        results.push({
          worker,
          confidence: 1.0,
          matchType: 'exact',
          matchField: 'name'
        });
        continue;
      }

      // Partial name match
      if (name.includes(queryLower)) {
        const confidence = queryLower.length / name.length;
        results.push({
          worker,
          confidence: Math.max(confidence, 0.7),
          matchType: 'partial',
          matchField: 'name'
        });
        continue;
      }

      // Fuzzy name match
      const nameScore = this.fuzzyMatch(queryLower, name);
      if (nameScore > 0.5) {
        results.push({
          worker,
          confidence: nameScore * 0.8,
          matchType: 'fuzzy',
          matchField: 'name'
        });
      }

      // Description match
      if (description.includes(queryLower)) {
        const confidence = Math.min(queryLower.length / description.length, 0.6);
        results.push({
          worker,
          confidence,
          matchType: 'partial',
          matchField: 'description'
        });
      }
    }

    // Sort by confidence and return top results
    return results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Connect to a worker using natural language or quick access
   */
  async connectToWorker(query: string): Promise<WorkerAccessSession> {
    // Record search
    this.searchHistory.push(query);
    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(-50);
    }

    // Find worker
    const results = this.findWorkers(query, 1);
    if (results.length === 0) {
      throw new Error(`No worker found for: "${query}"`);
    }

    const { worker } = results[0];

    // Check if already connected
    let session = this.activeSessions.get(worker.id);
    if (session && session.isActive) {
      // Switch to existing session
      await this.tmux.sendKeys(session.paneId, ''); // Focus pane
      session.lastActivity = new Date();
      this.emit('sessionResumed', session);
      return session;
    }

    // Create new session
    const paneId = await this.createWorkerPane(worker);

    session = {
      id: `session_${worker.id}_${Date.now()}`,
      workerId: worker.id,
      workerName: worker.descriptiveName || `Worker ${worker.id}`,
      paneId,
      startTime: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    this.activeSessions.set(worker.id, session);

    // Setup session
    await this.setupWorkerSession(session, worker);

    this.emit('sessionCreated', session);
    return session;
  }

  private async createWorkerPane(worker: ExtendedWorker): Promise<string> {
    // Create new pane for worker interaction
    const sessionId = 'main'; // Assumes main session exists
    const mainPaneId = 'main:0.0'; // Default main pane ID
    const newPane = await this.tmux.splitPane(sessionId, mainPaneId, 'horizontal', 50);

    // Set pane title
    const title = `${worker.descriptiveName} (${worker.quickAccessKey || '•'})`;
    await this.tmux.sendKeys(newPane.id,
      `tmux set-option -t ${newPane.id} pane-title "${title}"`);

    return newPane.id;
  }

  private async setupWorkerSession(session: WorkerAccessSession, worker: ExtendedWorker): Promise<void> {
    const { paneId } = session;

    // Clear pane and show worker info
    await this.tmux.sendKeys(paneId, 'clear');

    const workerInfo = this.formatWorkerInfo(worker);
    await this.tmux.sendKeys(paneId, `echo "${workerInfo}"`);

    // Setup interactive commands
    await this.tmux.sendKeys(paneId, 'echo "Connected to worker. Type commands or press Ctrl+D to return to primary terminal."');

    // Monitor for exit
    this.monitorWorkerSession(session);
  }

  private formatWorkerInfo(worker: ExtendedWorker): string {
    const info = [
      `╭─ Worker: ${worker.descriptiveName} ─╮`,
      `│ ID: ${worker.id}`,
      `│ Status: ${worker.status}`,
      `│ Quick Key: ${worker.quickAccessKey || 'None'}`,
      `│ Task: ${worker.currentTask?.description || 'No active task'}`,
      `│ Started: ${worker.startTime ? new Date(worker.startTime).toLocaleTimeString() : 'Unknown'}`,
      `╰${'─'.repeat(Math.max(30, worker.descriptiveName.length + 10))}╯`
    ];

    return info.join('\\n');
  }

  private monitorWorkerSession(session: WorkerAccessSession): void {
    // Setup monitoring for session activity
    const checkInterval = setInterval(() => {
      // Check if pane still exists and is active
      // This would need actual tmux integration to work properly
      session.lastActivity = new Date();
    }, 5000);

    // Cleanup after inactivity
    setTimeout(() => {
      clearInterval(checkInterval);
      if (Date.now() - session.lastActivity.getTime() > 300000) { // 5 minutes
        void this.closeWorkerSession(session.workerId);
      }
    }, 300000);
  }

  async closeWorkerSession(workerId: string): Promise<void> {
    const session = this.activeSessions.get(workerId);
    if (!session) {return;}

    try {
      // Close the pane
      await this.tmux.sendKeys(session.paneId, 'exit');
    } catch (error) {
      console.warn(`Failed to close worker pane: ${error instanceof Error ? error.message : String(error)}`);
    }

    session.isActive = false;
    this.activeSessions.delete(workerId);

    this.emit('sessionClosed', session);
  }

  /**
   * Get suggestions for similar workers when search fails
   */
  getSuggestions(query: string, limit: number = 3): string[] {
    const results = this.findWorkers(query, limit * 2);
    const suggestions = results
      .filter(r => r.confidence > 0.3)
      .map(r => r.worker.descriptiveName)
      .slice(0, limit);

    return suggestions;
  }

  /**
   * Quick access by numeric key
   */
  async quickAccess(key: number): Promise<WorkerAccessSession> {
    const workerId = this.quickKeyMap.get(key);
    if (!workerId) {
      throw new Error(`No worker assigned to key ${key}`);
    }

    const worker = this.workerRegistry.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    return this.connectToWorker(worker.descriptiveName);
  }

  /**
   * List all active sessions
   */
  getActiveSessions(): WorkerAccessSession[] {
    return Array.from(this.activeSessions.values()).filter(s => s.isActive);
  }

  /**
   * Assign a quick access key to a worker
   */
  assignQuickKey(workerId: string, key: number): boolean {
    const worker = this.workerRegistry.get(workerId);
    if (!worker) {
      return false;
    }

    // Check if key is already assigned
    if (this.quickKeyMap.has(key)) {
      return false;
    }

    // Remove existing key assignment for this worker
    if (worker.quickAccessKey) {
      this.quickKeyMap.delete(worker.quickAccessKey);
    }

    // Assign new key
    worker.quickAccessKey = key;
    this.quickKeyMap.set(key, workerId);

    this.emit('quickKeyAssigned', { workerId, key });
    return true;
  }

  /**
   * Remove quick access key from a worker
   */
  unassignQuickKey(workerId: string): boolean {
    const worker = this.workerRegistry.get(workerId);
    if (!worker || !worker.quickAccessKey) {
      return false;
    }

    const key = worker.quickAccessKey;
    this.quickKeyMap.delete(key);
    worker.quickAccessKey = undefined;

    this.emit('quickKeyUnassigned', { workerId, key });
    return true;
  }

  /**
   * Get quick access key assignments
   */
  getQuickKeyAssignments(): { key: number; workerId: string; workerName: string }[] {
    const assignments: { key: number; workerId: string; workerName: string }[] = [];

    for (const [key, workerId] of this.quickKeyMap.entries()) {
      const worker = this.workerRegistry.get(workerId);
      if (worker) {
        assignments.push({
          key,
          workerId,
          workerName: worker.descriptiveName
        });
      }
    }

    return assignments.sort((a, b) => a.key - b.key);
  }

  /**
   * Get all registered workers
   */
  getWorkers(): ExtendedWorker[] {
    return Array.from(this.workerRegistry.values());
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): ExtendedWorker | undefined {
    return this.workerRegistry.get(workerId);
  }

  /**
   * Update worker information
   */
  updateWorker(workerId: string, updates: Partial<ExtendedWorker>): void {
    const worker = this.workerRegistry.get(workerId);
    if (worker) {
      Object.assign(worker, updates);
      this.emit('workerUpdated', worker);
    }
  }

  /**
   * Simple fuzzy matching algorithm
   */
  private fuzzyMatch(query: string, target: string): number {
    const queryChars = query.split('');
    const targetChars = target.split('');

    let queryIndex = 0;
    let matches = 0;

    for (let i = 0; i < targetChars.length && queryIndex < queryChars.length; i++) {
      if (targetChars[i].toLowerCase() === queryChars[queryIndex].toLowerCase()) {
        matches++;
        queryIndex++;
      }
    }

    if (queryIndex !== queryChars.length) {
      return 0; // Not all query characters found
    }

    return matches / target.length;
  }

  /**
   * Get next available quick access key
   */
  getNextAvailableQuickKey(): number | null {
    for (let i = 1; i <= 9; i++) {
      if (!this.quickKeyMap.has(i)) {
        return i;
      }
    }
    return null;
  }

  /**
   * Auto-assign quick access key to a worker
   */
  autoAssignQuickKey(workerId: string): boolean {
    const nextKey = this.getNextAvailableQuickKey();
    if (nextKey === null) {
      return false;
    }
    return this.assignQuickKey(workerId, nextKey);
  }

  /**
   * Get search history for autocomplete
   */
  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Cleanup all sessions
   */
  async cleanup(): Promise<void> {
    const sessions = Array.from(this.activeSessions.keys());

    for (const workerId of sessions) {
      await this.closeWorkerSession(workerId);
    }

    this.workerRegistry.clear();
    this.quickKeyMap.clear();
    this.searchHistory = [];
    this.removeAllListeners();
  }

}