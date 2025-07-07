import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdvancedMemoryManager } from './advanced-memory-manager';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('AdvancedMemoryManager', () => {
  let memoryManager: AdvancedMemoryManager;
  const testDir = '.test-memory';

  beforeEach(async () => {
    // Clean test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  afterEach(async () => {
    if (memoryManager) {
      memoryManager.destroy();
    }
    // Clean test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Initialization', () => {
    it('should auto-initialize on first operation', async () => {
      memoryManager = new AdvancedMemoryManager({
        backend: undefined, // Use default
      });

      // Should not throw - auto-initializes
      await expect(
        memoryManager.remember('test-key', 'test-value')
      ).resolves.not.toThrow();

      const recalled = await memoryManager.recall('test-key');
      expect(recalled).toBe('test-value');
    });

    it('should handle multiple operations before explicit initialization', async () => {
      memoryManager = new AdvancedMemoryManager();

      // All operations should work without explicit initialization
      await memoryManager.remember('key1', 'value1');
      await memoryManager.remember('key2', { data: 'value2' });
      
      const value1 = await memoryManager.recall('key1');
      const value2 = await memoryManager.recall('key2');
      
      expect(value1).toBe('value1');
      expect(value2).toEqual({ data: 'value2' });
    });

    it('should not initialize multiple times', async () => {
      memoryManager = new AdvancedMemoryManager();

      // Initialize explicitly
      await memoryManager.initialize();
      
      // Should not reinitialize
      await memoryManager.initialize();
      
      // Operations should still work
      await memoryManager.remember('key', 'value');
      const value = await memoryManager.recall('key');
      expect(value).toBe('value');
    });
  });

  describe('Core Operations', () => {
    beforeEach(async () => {
      memoryManager = new AdvancedMemoryManager({
        enableCompression: false, // Disable for simpler testing
        enableEncryption: false,
      });
    });

    it('should remember and recall simple values', async () => {
      await memoryManager.remember('string-key', 'string-value');
      await memoryManager.remember('number-key', 42);
      await memoryManager.remember('object-key', { nested: { data: true } });

      expect(await memoryManager.recall('string-key')).toBe('string-value');
      expect(await memoryManager.recall('number-key')).toBe(42);
      expect(await memoryManager.recall('object-key')).toEqual({ nested: { data: true } });
    });

    it('should handle metadata', async () => {
      await memoryManager.remember('tagged-key', 'value', {
        tags: ['important', 'test'],
        category: 'testing',
        agentId: 'agent-123',
      });

      const entries = await memoryManager.query({ tags: ['important'] });
      expect(entries.length).toBe(1);
      expect(entries[0].metadata.category).toBe('testing');
      expect(entries[0].metadata.agentId).toBe('agent-123');
    });

    it('should forget entries', async () => {
      await memoryManager.remember('temp-key', 'temp-value');
      expect(await memoryManager.recall('temp-key')).toBe('temp-value');

      const forgotten = await memoryManager.forget('temp-key');
      expect(forgotten).toBe(true);
      
      expect(await memoryManager.recall('temp-key')).toBeNull();
    });

    it('should forget by tags', async () => {
      await memoryManager.remember('key1', 'value1', { tags: ['temp'] });
      await memoryManager.remember('key2', 'value2', { tags: ['temp', 'test'] });
      await memoryManager.remember('key3', 'value3', { tags: ['permanent'] });

      const count = await memoryManager.forgetByTags(['temp']);
      expect(count).toBe(2);

      expect(await memoryManager.recall('key1')).toBeNull();
      expect(await memoryManager.recall('key2')).toBeNull();
      expect(await memoryManager.recall('key3')).toBe('value3');
    });
  });

  describe('Search and Query', () => {
    beforeEach(async () => {
      memoryManager = new AdvancedMemoryManager({
        enableIndexing: true,
        enableCompression: false,
        enableEncryption: false,
      });

      // Add test data
      await memoryManager.remember('doc1', 'The quick brown fox');
      await memoryManager.remember('doc2', 'jumps over the lazy dog');
      await memoryManager.remember('doc3', 'The fox is quick', { tags: ['animal'] });
    });

    it('should search by content', async () => {
      const results = await memoryManager.search('fox');
      expect(results.length).toBe(2);
      expect(results.some(r => r.key === 'doc1')).toBe(true);
      expect(results.some(r => r.key === 'doc3')).toBe(true);
    });

    it('should query with filters', async () => {
      const results = await memoryManager.query({ tags: ['animal'] });
      expect(results.length).toBe(1);
      expect(results[0].key).toBe('doc3');
    });
  });

  describe('Compression and Encryption', () => {
    it('should handle compression', async () => {
      memoryManager = new AdvancedMemoryManager({
        enableCompression: true,
        enableEncryption: false,
      });

      const largeData = 'x'.repeat(10000);
      await memoryManager.remember('compressed', largeData);
      
      const recalled = await memoryManager.recall('compressed');
      expect(recalled).toBe(largeData);
    });

    it('should handle encryption', async () => {
      memoryManager = new AdvancedMemoryManager({
        enableCompression: false,
        enableEncryption: true,
        encryptionKey: 'test-key',
      });

      const sensitiveData = { password: 'secret123' };
      await memoryManager.remember('encrypted', sensitiveData);
      
      const recalled = await memoryManager.recall('encrypted');
      expect(recalled).toEqual(sensitiveData);
    });

    it('should handle both compression and encryption', async () => {
      memoryManager = new AdvancedMemoryManager({
        enableCompression: true,
        enableEncryption: true,
        encryptionKey: 'test-key',
      });

      const data = { large: 'x'.repeat(1000), sensitive: 'secret' };
      await memoryManager.remember('both', data);
      
      const recalled = await memoryManager.recall('both');
      expect(recalled).toEqual(data);
    });
  });

  describe('TTL and Retention', () => {
    it('should respect TTL', async () => {
      memoryManager = new AdvancedMemoryManager({
        ttlCheckInterval: 100, // 100ms for faster testing
      });

      // Add entry with 200ms TTL
      await memoryManager.remember('ttl-key', 'ttl-value', {
        ttl: 200,
      });

      // Should exist initially
      expect(await memoryManager.recall('ttl-key')).toBe('ttl-value');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should be gone
      expect(await memoryManager.recall('ttl-key')).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should provide statistics', async () => {
      memoryManager = new AdvancedMemoryManager();

      await memoryManager.remember('key1', 'value1', { tags: ['tag1'], category: 'cat1' });
      await memoryManager.remember('key2', 'value2', { tags: ['tag1', 'tag2'], category: 'cat1' });
      await memoryManager.remember('key3', 'value3', { tags: ['tag2'], category: 'cat2' });

      const stats = await memoryManager.getStats();
      
      expect(stats.totalEntries).toBe(3);
      expect(stats.topTags).toContainEqual({ tag: 'tag1', count: 2 });
      expect(stats.topTags).toContainEqual({ tag: 'tag2', count: 2 });
      expect(stats.topCategories).toContainEqual({ category: 'cat1', count: 2 });
    });
  });

  describe('Import/Export', () => {
    it('should export and import data', async () => {
      memoryManager = new AdvancedMemoryManager();

      await memoryManager.remember('key1', 'value1');
      await memoryManager.remember('key2', { data: 'value2' });

      const exported = await memoryManager.export('json');
      
      // Clear and re-import
      await memoryManager.clear();
      expect(await memoryManager.recall('key1')).toBeNull();

      await memoryManager.import(exported, 'json');
      
      expect(await memoryManager.recall('key1')).toBe('value1');
      expect(await memoryManager.recall('key2')).toEqual({ data: 'value2' });
    });
  });
});