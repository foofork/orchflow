// Memory types for OrchFlow

export interface MemoryEntry {
  id: string;
  key: string;
  value: any;
  metadata: {
    created: Date;
    updated: Date;
    accessed: Date;
    accessCount: number;
    tags: string[];
    category?: string;
    agentId?: string;
    sessionId?: string;
    ttl?: number;
    compressed?: boolean;
    encrypted?: boolean;
  };
  embeddings?: number[];
}

export interface MemoryQuery {
  key?: string;
  tags?: string[];
  category?: string;
  agentId?: string;
  sessionId?: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  limit?: number;
  offset?: number;
  sortBy?: 'created' | 'updated' | 'accessed' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface MemoryBackend {
  name: string;
  initialize(): Promise<void>;
  get(key: string): Promise<MemoryEntry | null>;
  set(entry: MemoryEntry): Promise<void>;
  delete(key: string): Promise<boolean>;
  query(query: MemoryQuery): Promise<MemoryEntry[]>;
  clear(): Promise<void>;
  export(format: 'json' | 'csv'): Promise<string>;
  import(data: string, format: 'json' | 'csv'): Promise<void>;
  getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }>;
}

export interface MemoryIndex {
  build(entries: MemoryEntry[]): Promise<void>;
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  addEntry(entry: MemoryEntry): Promise<void>;
  removeEntry(id: string): Promise<void>;
  clear(): Promise<void>;
}