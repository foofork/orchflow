import { MemoryBackend, MemoryEntry, MemoryQuery } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class MarkdownBackend implements MemoryBackend {
  name = 'markdown';
  private basePath: string;
  
  constructor(basePath: string) {
    this.basePath = basePath;
  }
  
  async initialize(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'entries'), { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'indexes'), { recursive: true });
  }
  
  async get(key: string): Promise<MemoryEntry | null> {
    try {
      const filename = this.keyToFilename(key);
      const filePath = path.join(this.basePath, 'entries', filename);
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseMarkdown(content);
    } catch (error) {
      return null;
    }
  }
  
  async set(entry: MemoryEntry): Promise<void> {
    const filename = this.keyToFilename(entry.key);
    const filePath = path.join(this.basePath, 'entries', filename);
    const content = this.toMarkdown(entry);
    await fs.writeFile(filePath, content);
    
    // Update index
    await this.updateIndex(entry);
  }
  
  async delete(key: string): Promise<boolean> {
    try {
      const filename = this.keyToFilename(key);
      const filePath = path.join(this.basePath, 'entries', filename);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const files = await fs.readdir(path.join(this.basePath, 'entries'));
    const entries: MemoryEntry[] = [];
    
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      
      const filePath = path.join(this.basePath, 'entries', file);
      const content = await fs.readFile(filePath, 'utf-8');
      const entry = this.parseMarkdown(content);
      
      if (!entry) continue;
      
      // Apply filters
      if (query.key && !entry.key.includes(query.key)) continue;
      if (query.category && entry.metadata.category !== query.category) continue;
      if (query.agentId && entry.metadata.agentId !== query.agentId) continue;
      if (query.sessionId && entry.metadata.sessionId !== query.sessionId) continue;
      
      if (query.tags && query.tags.length > 0) {
        const hasAllTags = query.tags.every(tag => 
          entry.metadata.tags.includes(tag)
        );
        if (!hasAllTags) continue;
      }
      
      if (query.dateRange) {
        const created = entry.metadata.created.getTime();
        if (query.dateRange.start && created < query.dateRange.start.getTime()) continue;
        if (query.dateRange.end && created > query.dateRange.end.getTime()) continue;
      }
      
      entries.push(entry);
    }
    
    // Sort
    if (query.sortBy) {
      entries.sort((a, b) => {
        let aVal, bVal;
        
        switch (query.sortBy) {
          case 'created':
            aVal = a.metadata.created.getTime();
            bVal = b.metadata.created.getTime();
            break;
          case 'updated':
            aVal = a.metadata.updated.getTime();
            bVal = b.metadata.updated.getTime();
            break;
          case 'accessed':
            aVal = a.metadata.accessed.getTime();
            bVal = b.metadata.accessed.getTime();
            break;
          default:
            return 0;
        }
        
        return query.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }
    
    // Paginate
    const start = query.offset || 0;
    const end = query.limit ? start + query.limit : entries.length;
    
    return entries.slice(start, end);
  }
  
  async clear(): Promise<void> {
    const files = await fs.readdir(path.join(this.basePath, 'entries'));
    for (const file of files) {
      await fs.unlink(path.join(this.basePath, 'entries', file));
    }
  }
  
  async export(format: 'json' | 'csv'): Promise<string> {
    const entries = await this.query({});
    
    switch (format) {
      case 'json':
        // Serialize with proper date handling
        const serializable = entries.map(e => ({
          ...e,
          metadata: {
            ...e.metadata,
            created: e.metadata.created.toISOString(),
            updated: e.metadata.updated.toISOString(),
            accessed: e.metadata.accessed.toISOString(),
          }
        }));
        return JSON.stringify(serializable, null, 2);
        
      case 'csv':
        const headers = ['id', 'key', 'value', 'created', 'tags', 'category'];
        const rows = entries.map(e => [
          e.id,
          e.key,
          JSON.stringify(e.value),
          e.metadata.created.toISOString(),
          e.metadata.tags.join(';'),
          e.metadata.category || '',
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  async import(data: string, format: 'json' | 'csv'): Promise<void> {
    let entries: MemoryEntry[];
    
    switch (format) {
      case 'json':
        const parsed = JSON.parse(data);
        entries = parsed.map((e: any) => ({
          ...e,
          metadata: {
            ...e.metadata,
            created: new Date(e.metadata.created),
            updated: new Date(e.metadata.updated),
            accessed: new Date(e.metadata.accessed),
          }
        }));
        break;
        
      case 'csv':
        const lines = data.split('\n');
        const headers = lines[0].split(',');
        entries = lines.slice(1).map(line => {
          const values = line.split(',');
          return {
            id: values[0],
            key: values[1],
            value: JSON.parse(values[2]),
            metadata: {
              created: new Date(values[3]),
              updated: new Date(values[3]),
              accessed: new Date(values[3]),
              accessCount: 0,
              tags: values[4] ? values[4].split(';') : [],
              category: values[5] || undefined,
            },
          } as MemoryEntry;
        });
        break;
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    for (const entry of entries) {
      await this.set(entry);
    }
  }
  
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    const files = await fs.readdir(path.join(this.basePath, 'entries'));
    let totalSize = 0;
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;
    
    for (const file of files) {
      const filePath = path.join(this.basePath, 'entries', file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
      
      const content = await fs.readFile(filePath, 'utf-8');
      const entry = this.parseMarkdown(content);
      
      if (entry) {
        if (!oldestEntry || entry.metadata.created < oldestEntry) {
          oldestEntry = entry.metadata.created;
        }
        if (!newestEntry || entry.metadata.created > newestEntry) {
          newestEntry = entry.metadata.created;
        }
      }
    }
    
    return {
      totalEntries: files.length,
      totalSize,
      oldestEntry,
      newestEntry,
    };
  }
  
  private keyToFilename(key: string): string {
    // Sanitize key for filesystem
    return key.replace(/[^a-zA-Z0-9-_]/g, '_') + '.md';
  }
  
  private toMarkdown(entry: MemoryEntry): string {
    const frontmatter = {
      id: entry.id,
      key: entry.key,
      created: entry.metadata.created.toISOString(),
      updated: entry.metadata.updated.toISOString(),
      accessed: entry.metadata.accessed.toISOString(),
      accessCount: entry.metadata.accessCount,
      tags: entry.metadata.tags,
      category: entry.metadata.category,
      agentId: entry.metadata.agentId,
      sessionId: entry.metadata.sessionId,
      ttl: entry.metadata.ttl,
      compressed: entry.metadata.compressed,
      encrypted: entry.metadata.encrypted,
    };
    
    const yamlFrontmatter = yaml.dump(frontmatter);
    const valueStr = typeof entry.value === 'string' 
      ? entry.value 
      : JSON.stringify(entry.value, null, 2);
    
    return `---
${yamlFrontmatter}---

# ${entry.key}

## Value

\`\`\`
${valueStr}
\`\`\`

## Metadata

- **Created**: ${entry.metadata.created.toLocaleString()}
- **Updated**: ${entry.metadata.updated.toLocaleString()}
- **Accessed**: ${entry.metadata.accessed.toLocaleString()} (${entry.metadata.accessCount} times)
- **Tags**: ${entry.metadata.tags.join(', ') || 'None'}
- **Category**: ${entry.metadata.category || 'None'}
`;
  }
  
  private parseMarkdown(content: string): MemoryEntry | null {
    try {
      const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!match) return null;
      
      const frontmatter = yaml.load(match[1]) as any;
      const body = match[2];
      
      // Extract value from code block
      const valueMatch = body.match(/```\n([\s\S]*?)\n```/);
      let value = valueMatch ? valueMatch[1] : '';
      
      // Try to parse as JSON
      try {
        value = JSON.parse(value);
      } catch {
        // Keep as string
      }
      
      return {
        id: frontmatter.id,
        key: frontmatter.key,
        value,
        metadata: {
          created: new Date(frontmatter.created),
          updated: new Date(frontmatter.updated),
          accessed: new Date(frontmatter.accessed),
          accessCount: frontmatter.accessCount,
          tags: frontmatter.tags || [],
          category: frontmatter.category,
          agentId: frontmatter.agentId,
          sessionId: frontmatter.sessionId,
          ttl: frontmatter.ttl,
          compressed: frontmatter.compressed,
          encrypted: frontmatter.encrypted,
        },
      };
    } catch (error) {
      console.error('Failed to parse markdown:', error);
      return null;
    }
  }
  
  private async updateIndex(entry: MemoryEntry): Promise<void> {
    // Update tag index
    for (const tag of entry.metadata.tags) {
      const indexPath = path.join(this.basePath, 'indexes', `tag-${tag}.json`);
      let index: string[] = [];
      
      try {
        const content = await fs.readFile(indexPath, 'utf-8');
        index = JSON.parse(content);
      } catch {
        // Index doesn't exist yet
      }
      
      if (!index.includes(entry.key)) {
        index.push(entry.key);
        await fs.writeFile(indexPath, JSON.stringify(index));
      }
    }
    
    // Update category index
    if (entry.metadata.category) {
      const indexPath = path.join(this.basePath, 'indexes', `category-${entry.metadata.category}.json`);
      let index: string[] = [];
      
      try {
        const content = await fs.readFile(indexPath, 'utf-8');
        index = JSON.parse(content);
      } catch {
        // Index doesn't exist yet
      }
      
      if (!index.includes(entry.key)) {
        index.push(entry.key);
        await fs.writeFile(indexPath, JSON.stringify(index));
      }
    }
  }
}