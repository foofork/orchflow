import { EventBus, OrchflowEvents } from '../core/event-bus';
import { MemoryEntry, MemoryQuery, MemoryBackend, MemoryIndex } from './types';
import { MarkdownBackend } from './backends/markdown-backend';
import { InMemoryIndex } from './indexing/in-memory-index';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface MemoryManagerConfig {
  backend?: MemoryBackend;
  enableIndexing?: boolean;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  encryptionKey?: string;
  maxMemorySize?: number;
  ttlCheckInterval?: number;
  retentionDays?: number;
}

export class AdvancedMemoryManager {
  private backend: MemoryBackend;
  private index?: MemoryIndex;
  private config: Required<MemoryManagerConfig>;
  private cache: Map<string, MemoryEntry> = new Map();
  private ttlCheckTimer?: NodeJS.Timer;
  private initialized: boolean = false;
  
  constructor(config: MemoryManagerConfig = {}) {
    this.config = {
      backend: config.backend || new MarkdownBackend('.orchflow/memory'),
      enableIndexing: config.enableIndexing ?? true,
      enableCompression: config.enableCompression ?? true,
      enableEncryption: config.enableEncryption ?? false,
      encryptionKey: config.encryptionKey || 'default-key',
      maxMemorySize: config.maxMemorySize || 100 * 1024 * 1024, // 100MB
      ttlCheckInterval: config.ttlCheckInterval || 60000, // 1 minute
      retentionDays: config.retentionDays || 30,
    };
    
    this.backend = this.config.backend;
    
    if (this.config.enableIndexing) {
      this.index = new InMemoryIndex();
    }
    
    this.setupEventHandlers();
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.backend.initialize();
    
    // Build index from existing entries
    if (this.index) {
      const allEntries = await this.backend.query({});
      await this.index.build(allEntries);
    }
    
    // Start TTL checker
    this.ttlCheckTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.ttlCheckInterval);
    
    this.initialized = true;
    console.log('Advanced Memory Manager initialized');
  }
  
  private setupEventHandlers(): void {
    // Track command completions
    EventBus.on(OrchflowEvents.COMMAND_COMPLETED, async ({ command, result }) => {
      await this.remember(`cmd:${command}`, result, {
        tags: ['command', 'result'],
        category: 'execution',
      });
    });
    
    // Track agent messages
    EventBus.on(OrchflowEvents.AGENT_MESSAGE, async ({ agentId, message }) => {
      await this.remember(`agent:${agentId}:${Date.now()}`, message, {
        tags: ['agent', 'message'],
        agentId,
      });
    });
  }
  
  async remember(
    key: string,
    value: any,
    metadata?: Partial<MemoryEntry['metadata']>
  ): Promise<void> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    const now = new Date();
    
    // Create entry
    const entry: MemoryEntry = {
      id: this.generateId(),
      key,
      value: await this.processValue(value),
      metadata: {
        created: now,
        updated: now,
        accessed: now,
        accessCount: 0,
        tags: metadata?.tags || [],
        category: metadata?.category,
        agentId: metadata?.agentId,
        sessionId: metadata?.sessionId,
        ttl: metadata?.ttl,
        compressed: this.config.enableCompression,
        encrypted: this.config.enableEncryption,
      },
    };
    
    // Add to backend
    await this.backend.set(entry);
    
    // Update index
    if (this.index) {
      await this.index.addEntry(entry);
    }
    
    // Update cache
    this.cache.set(key, entry);
    
    // Check memory size
    await this.checkMemorySize();
  }
  
  async recall(key: string): Promise<any | null> {
    // Check cache first
    let entry = this.cache.get(key);
    
    if (!entry) {
      entry = await this.backend.get(key);
      if (entry) {
        this.cache.set(key, entry);
      }
    }
    
    if (!entry) return null;
    
    // Update access metadata
    entry.metadata.accessed = new Date();
    entry.metadata.accessCount++;
    await this.backend.set(entry);
    
    // Return processed value
    return this.unprocessValue(entry.value, entry.metadata);
  }
  
  async search(query: string, limit: number = 10): Promise<MemoryEntry[]> {
    if (this.index) {
      return this.index.search(query, limit);
    }
    
    // Fallback to basic search
    const entries = await this.backend.query({ limit });
    return entries.filter(e => 
      JSON.stringify(e.value).toLowerCase().includes(query.toLowerCase()) ||
      e.key.toLowerCase().includes(query.toLowerCase())
    );
  }
  
  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const entries = await this.backend.query(query);
    
    // Unprocess values
    for (const entry of entries) {
      entry.value = await this.unprocessValue(entry.value, entry.metadata);
    }
    
    return entries;
  }
  
  async forget(key: string): Promise<boolean> {
    const deleted = await this.backend.delete(key);
    
    if (deleted) {
      this.cache.delete(key);
      if (this.index) {
        const entry = await this.backend.get(key);
        if (entry) {
          await this.index.removeEntry(entry.id);
        }
      }
    }
    
    return deleted;
  }
  
  async forgetByTags(tags: string[]): Promise<number> {
    const entries = await this.backend.query({ tags });
    let count = 0;
    
    for (const entry of entries) {
      if (await this.forget(entry.key)) {
        count++;
      }
    }
    
    return count;
  }
  
  private async processValue(value: any): Promise<any> {
    let processed = value;
    
    // Convert to string if needed
    if (typeof processed !== 'string') {
      processed = JSON.stringify(processed);
    }
    
    // Compress if enabled
    if (this.config.enableCompression) {
      const buffer = Buffer.isBuffer(processed) ? processed : Buffer.from(processed, 'utf8');
      processed = await gzip(buffer);
    }
    
    // Encrypt if enabled
    if (this.config.enableEncryption) {
      processed = this.encrypt(processed);
    }
    
    return processed;
  }
  
  private async unprocessValue(
    value: any,
    metadata: MemoryEntry['metadata']
  ): Promise<any> {
    let processed = value;
    
    // Decrypt if needed
    if (metadata.encrypted) {
      processed = this.decrypt(processed);
    }
    
    // Decompress if needed
    if (metadata.compressed) {
      processed = await gunzip(processed);
      processed = processed.toString();
    }
    
    // Parse JSON if possible
    try {
      return JSON.parse(processed);
    } catch {
      return processed;
    }
  }
  
  private encrypt(data: Buffer | string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(this.config.encryptionKey, 'salt', 32), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }
  
  private decrypt(data: string): Buffer {
    const [ivHex, encryptedHex] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(this.config.encryptionKey, 'salt', 32), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }
  
  private generateId(): string {
    return `mem-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
  
  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    const entries = await this.backend.query({});
    
    for (const entry of entries) {
      // Check TTL
      if (entry.metadata.ttl) {
        const expiryTime = entry.metadata.created.getTime() + entry.metadata.ttl;
        if (now > expiryTime) {
          await this.forget(entry.key);
          continue;
        }
      }
      
      // Check retention policy
      const retentionTime = entry.metadata.accessed.getTime() + 
        (this.config.retentionDays * 24 * 60 * 60 * 1000);
      if (now > retentionTime) {
        await this.forget(entry.key);
      }
    }
  }
  
  private async checkMemorySize(): Promise<void> {
    const stats = await this.backend.getStats();
    
    if (stats.totalSize > this.config.maxMemorySize) {
      // Remove oldest entries until under limit
      const entries = await this.backend.query({
        sortBy: 'accessed',
        sortOrder: 'asc',
      });
      
      let removed = 0;
      for (const entry of entries) {
        if (stats.totalSize - removed <= this.config.maxMemorySize * 0.9) {
          break;
        }
        
        await this.forget(entry.key);
        removed += JSON.stringify(entry).length;
      }
    }
  }
  
  async export(format: 'json' | 'csv' = 'json'): Promise<string> {
    return this.backend.export(format);
  }
  
  async import(data: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    await this.backend.import(data, format);
    
    // Rebuild index
    if (this.index) {
      const entries = await this.backend.query({});
      await this.index.build(entries);
    }
  }
  
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    cacheSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
    topTags: Array<{ tag: string; count: number }>;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    const backendStats = await this.backend.getStats();
    const entries = await this.backend.query({});
    
    // Calculate tag statistics
    const tagCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    
    for (const entry of entries) {
      for (const tag of entry.metadata.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
      if (entry.metadata.category) {
        categoryCounts.set(
          entry.metadata.category,
          (categoryCounts.get(entry.metadata.category) || 0) + 1
        );
      }
    }
    
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
    
    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, count]) => ({ category, count }));
    
    return {
      ...backendStats,
      cacheSize: this.cache.size,
      topTags,
      topCategories,
    };
  }
  
  async clear(): Promise<void> {
    await this.backend.clear();
    this.cache.clear();
    if (this.index) {
      await this.index.clear();
    }
  }
  
  destroy(): void {
    if (this.ttlCheckTimer) {
      clearInterval(this.ttlCheckTimer);
    }
    this.cache.clear();
  }
}