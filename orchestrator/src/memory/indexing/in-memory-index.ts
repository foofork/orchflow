import { MemoryIndex, MemoryEntry } from '../types';

interface IndexEntry {
  id: string;
  tokens: Set<string>;
  entry: MemoryEntry;
}

export class InMemoryIndex implements MemoryIndex {
  protected entries: Map<string, IndexEntry> = new Map();
  private tokenIndex: Map<string, Set<string>> = new Map(); // token -> entry IDs
  
  async build(entries: MemoryEntry[]): Promise<void> {
    this.clear();
    
    for (const entry of entries) {
      await this.addEntry(entry);
    }
  }
  
  async search(query: string, limit: number = 10): Promise<MemoryEntry[]> {
    const queryTokens = this.tokenize(query.toLowerCase());
    const scores = new Map<string, number>();
    
    // Calculate relevance scores
    for (const token of queryTokens) {
      const entryIds = this.tokenIndex.get(token);
      if (!entryIds) continue;
      
      for (const id of entryIds) {
        scores.set(id, (scores.get(id) || 0) + 1);
      }
    }
    
    // Sort by score and return top entries
    const sortedIds = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
    
    const results: MemoryEntry[] = [];
    for (const id of sortedIds) {
      const indexEntry = this.entries.get(id);
      if (indexEntry) {
        results.push(indexEntry.entry);
      }
    }
    
    return results;
  }
  
  async addEntry(entry: MemoryEntry): Promise<void> {
    const text = this.extractText(entry);
    const tokens = this.tokenize(text);
    
    const indexEntry: IndexEntry = {
      id: entry.id,
      tokens,
      entry,
    };
    
    this.entries.set(entry.id, indexEntry);
    
    // Update token index
    for (const token of tokens) {
      if (!this.tokenIndex.has(token)) {
        this.tokenIndex.set(token, new Set());
      }
      this.tokenIndex.get(token)!.add(entry.id);
    }
  }
  
  async removeEntry(id: string): Promise<void> {
    const indexEntry = this.entries.get(id);
    if (!indexEntry) return;
    
    // Remove from token index
    for (const token of indexEntry.tokens) {
      const entryIds = this.tokenIndex.get(token);
      if (entryIds) {
        entryIds.delete(id);
        if (entryIds.size === 0) {
          this.tokenIndex.delete(token);
        }
      }
    }
    
    this.entries.delete(id);
  }
  
  async clear(): Promise<void> {
    this.entries.clear();
    this.tokenIndex.clear();
  }
  
  private extractText(entry: MemoryEntry): string {
    const parts: string[] = [
      entry.key,
      JSON.stringify(entry.value),
      ...entry.metadata.tags,
      entry.metadata.category || '',
    ];
    
    return parts.join(' ').toLowerCase();
  }
  
  private tokenize(text: string): Set<string> {
    // Simple tokenization - split on non-alphanumeric
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 2); // Skip short tokens
    
    return new Set(tokens);
  }
}

// Advanced index with fuzzy matching
export class FuzzyIndex extends InMemoryIndex {
  private ngramIndex: Map<string, Set<string>> = new Map(); // ngram -> entry IDs
  
  async addEntry(entry: MemoryEntry): Promise<void> {
    await super.addEntry(entry);
    
    const text = this.extractText(entry);
    const ngrams = this.generateNgrams(text);
    
    for (const ngram of ngrams) {
      if (!this.ngramIndex.has(ngram)) {
        this.ngramIndex.set(ngram, new Set());
      }
      this.ngramIndex.get(ngram)!.add(entry.id);
    }
  }
  
  async removeEntry(id: string): Promise<void> {
    const indexEntry = this.entries.get(id);
    if (indexEntry) {
      const text = this.extractText(indexEntry.entry);
      const ngrams = this.generateNgrams(text);
      
      for (const ngram of ngrams) {
        const entryIds = this.ngramIndex.get(ngram);
        if (entryIds) {
          entryIds.delete(id);
          if (entryIds.size === 0) {
            this.ngramIndex.delete(ngram);
          }
        }
      }
    }
    
    await super.removeEntry(id);
  }
  
  async search(query: string, limit: number = 10): Promise<MemoryEntry[]> {
    const queryNgrams = this.generateNgrams(query.toLowerCase());
    const scores = new Map<string, number>();
    
    // Score based on ngram matches
    for (const ngram of queryNgrams) {
      const entryIds = this.ngramIndex.get(ngram);
      if (!entryIds) continue;
      
      for (const id of entryIds) {
        scores.set(id, (scores.get(id) || 0) + 1);
      }
    }
    
    // Also check exact token matches
    const tokenResults = await super.search(query, limit * 2);
    for (const entry of tokenResults) {
      scores.set(entry.id, (scores.get(entry.id) || 0) + 5); // Higher weight for exact matches
    }
    
    // Sort by score and return top entries
    const sortedIds = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
    
    const results: MemoryEntry[] = [];
    for (const id of sortedIds) {
      const indexEntry = this.entries.get(id);
      if (indexEntry) {
        results.push(indexEntry.entry);
      }
    }
    
    return results;
  }
  
  async clear(): Promise<void> {
    await super.clear();
    this.ngramIndex.clear();
  }
  
  private generateNgrams(text: string, n: number = 3): Set<string> {
    const ngrams = new Set<string>();
    const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    for (let i = 0; i <= cleaned.length - n; i++) {
      ngrams.add(cleaned.substring(i, i + n));
    }
    
    return ngrams;
  }
  
  private extractText(entry: MemoryEntry): string {
    const parts: string[] = [
      entry.key,
      JSON.stringify(entry.value),
      ...entry.metadata.tags,
      entry.metadata.category || '',
    ];
    
    return parts.join(' ').toLowerCase();
  }
}