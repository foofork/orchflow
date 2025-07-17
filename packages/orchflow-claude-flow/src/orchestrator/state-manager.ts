import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import type { Task } from './orchflow-orchestrator';

export interface StateConfig {
  database: string;
  autoSave?: boolean;
  saveInterval?: number;
}

export interface SessionData {
  id: string;
  startTime: Date;
  lastUpdate: Date;
  tasks: Task[];
  workers: any[];
  metadata: Record<string, any>;
  mainObjective?: string;
  activeSubtasks?: string[];
  completedTasks?: string[];
  dependencies?: [string, string[]][];
  taskHistory?: Array<{task: string, status: string, timestamp: Date}>;
}

export interface StateSnapshot {
  version: string;
  timestamp: Date;
  session: SessionData;
  checksum?: string;
}

export class StateManager extends EventEmitter {
  private config: StateConfig;
  private dbPath: string;
  private sessionData: SessionData;
  private saveInterval?: NodeJS.Timeout;
  private isDirty: boolean = false;
  private initialized: boolean = false;

  constructor(config: StateConfig) {
    super();
    this.config = {
      autoSave: true,
      saveInterval: 30000, // 30 seconds
      ...config
    };
    this.dbPath = this.config.database;
    this.sessionData = this.createNewSession();
  }

  async initialize(): Promise<void> {
    console.log('Initializing State Manager...');

    // Ensure database directory exists
    const dbDir = path.dirname(this.dbPath);
    await fs.mkdir(dbDir, { recursive: true });

    // Try to load existing state
    try {
      await this.loadState();
    } catch (error) {
      console.log('No existing state found, starting fresh');
    }

    // Start auto-save if enabled
    if (this.config.autoSave) {
      this.startAutoSave();
    }

    this.initialized = true;
    console.log('State Manager initialized');
  }

  private createNewSession(): SessionData {
    return {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date(),
      lastUpdate: new Date(),
      tasks: [],
      workers: [],
      metadata: {}
    };
  }

  async persistTask(task: Task): Promise<void> {
    if (!this.initialized) {
      throw new Error('StateManager not initialized');
    }

    // Add or update task in session data
    const existingIndex = this.sessionData.tasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      this.sessionData.tasks[existingIndex] = { ...task };
    } else {
      this.sessionData.tasks.push({ ...task });
    }

    this.sessionData.lastUpdate = new Date();
    this.isDirty = true;

    this.emit('taskPersisted', task);

    // Save immediately for critical updates
    if (task.status === 'completed' || task.status === 'failed') {
      await this.save();
    }
  }

  async updateTask(task: Task): Promise<void> {
    await this.persistTask(task);
  }

  async getTask(taskId: string): Promise<Task | undefined> {
    return this.sessionData.tasks.find(t => t.id === taskId);
  }

  async getAllTasks(): Promise<Task[]> {
    return [...this.sessionData.tasks];
  }

  async persistWorker(worker: any): Promise<void> {
    const existingIndex = this.sessionData.workers.findIndex(w => w.id === worker.id);
    if (existingIndex >= 0) {
      this.sessionData.workers[existingIndex] = { ...worker };
    } else {
      this.sessionData.workers.push({ ...worker });
    }

    this.sessionData.lastUpdate = new Date();
    this.isDirty = true;

    this.emit('workerPersisted', worker);
  }

  async removeWorker(workerId: string): Promise<void> {
    this.sessionData.workers = this.sessionData.workers.filter(w => w.id !== workerId);
    this.sessionData.lastUpdate = new Date();
    this.isDirty = true;
  }

  async getSessionData(): Promise<SessionData> {
    return { ...this.sessionData };
  }

  async saveSessionData(data: Partial<SessionData>): Promise<void> {
    this.sessionData = {
      ...this.sessionData,
      ...data,
      lastUpdate: new Date()
    };
    this.isDirty = true;
    await this.save();
  }

  async setMetadata(key: string, value: any): Promise<void> {
    this.sessionData.metadata[key] = value;
    this.sessionData.lastUpdate = new Date();
    this.isDirty = true;
  }

  async getMetadata(key: string): Promise<any> {
    return this.sessionData.metadata[key];
  }

  async saveAllTasks(tasks: Task[]): Promise<void> {
    this.sessionData.tasks = [...tasks];
    this.sessionData.lastUpdate = new Date();
    this.isDirty = true;
    await this.save();
  }

  private async save(): Promise<void> {
    if (!this.isDirty) {return;}

    const snapshot: StateSnapshot = {
      version: '1.0.0',
      timestamp: new Date(),
      session: this.sessionData
    };

    try {
      // Save to temporary file first (atomic write)
      const tempPath = `${this.dbPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2));

      // Move temp file to actual path
      await fs.rename(tempPath, this.dbPath);

      this.isDirty = false;
      this.emit('stateSaved', snapshot);
    } catch (error) {
      console.error('Failed to save state:', error);
      this.emit('saveError', error);
      throw error;
    }
  }

  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      const snapshot: StateSnapshot = JSON.parse(data);

      // Validate version
      if (snapshot.version !== '1.0.0') {
        throw new Error(`Unsupported state version: ${snapshot.version}`);
      }

      // Restore session data
      this.sessionData = {
        ...snapshot.session,
        startTime: new Date(snapshot.session.startTime),
        lastUpdate: new Date(snapshot.session.lastUpdate),
        tasks: snapshot.session.tasks.map(t => ({
          ...t,
          // Ensure dates are Date objects
          createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined
        }))
      };

      this.emit('stateLoaded', snapshot);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, start fresh
    }
  }

  private startAutoSave(): void {
    this.saveInterval = setInterval(async () => {
      if (this.isDirty) {
        try {
          await this.save();
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, this.config.saveInterval);
  }

  async createSnapshot(name?: string): Promise<string> {
    const snapshotName = name || `snapshot_${Date.now()}`;
    const snapshotPath = path.join(
      path.dirname(this.dbPath),
      'snapshots',
      `${snapshotName}.json`
    );

    // Ensure snapshots directory exists
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });

    // Save current state to snapshot
    const snapshot: StateSnapshot = {
      version: '1.0.0',
      timestamp: new Date(),
      session: this.sessionData
    };

    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    this.emit('snapshotCreated', { name: snapshotName, path: snapshotPath });
    return snapshotPath;
  }

  async restoreSnapshot(snapshotPath: string): Promise<void> {
    const data = await fs.readFile(snapshotPath, 'utf-8');
    const snapshot: StateSnapshot = JSON.parse(data);

    // Create backup of current state
    await this.createSnapshot('before_restore');

    // Restore from snapshot
    this.sessionData = snapshot.session;
    this.isDirty = true;
    await this.save();

    this.emit('snapshotRestored', snapshot);
  }

  async listSnapshots(): Promise<string[]> {
    const snapshotsDir = path.join(path.dirname(this.dbPath), 'snapshots');

    try {
      const files = await fs.readdir(snapshotsDir);
      return files.filter(f => f.endsWith('.json'));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    // Stop auto-save
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    // Save final state
    if (this.isDirty) {
      await this.save();
    }

    this.removeAllListeners();
  }
}