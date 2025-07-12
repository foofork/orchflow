import { describe, it, expect, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  createMockDerivedStore,
  createTrackedStore,
  createMockWritable,
  createMockReadable,
  createMockManagerStores,
  waitForStoreUpdate,
  createMockSession,
  createMockPane,
  createMockPlugin
} from './store-mocks';
import { createTypedMock } from '@/test/mock-factory';

describe('Store Mock Utilities', () => {
  let cleanup: Array<() => void> = [];

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
  });
  describe('createMockDerivedStore', () => {
    it('should create a writable store that mimics a derived store', () => {
      const store = createMockDerivedStore('initial');
      
      expect(store._isDerived).toBe(true);
      expect(get(store)).toBe('initial');
      
      store.set('updated');
      expect(get(store)).toBe('updated');
    });
  });

  describe('createTrackedStore', () => {
    it('should track subscriptions and updates', () => {
      const store = createTrackedStore(42);
      
      expect(store.getSubscriberCount()).toBe(0);
      expect(store.getCurrentValue()).toBe(42);
      expect(store.getUpdateHistory()).toEqual([42]);
      
      const unsubscribe = store.subscribe(() => {});
      expect(store.getSubscriberCount()).toBe(1);
      
      store.set(100);
      expect(store.getCurrentValue()).toBe(100);
      expect(store.getUpdateHistory()).toEqual([42, 100]);
      
      unsubscribe();
      expect(store.getSubscriberCount()).toBe(0);
    });
  });

  describe('createMockManagerStores', () => {
    it('should create properly typed manager stores and mocks', () => {
      const mocks = createMockManagerStores();
      
      expect(mocks.manager.createTerminal).toBeDefined();
      expect(mocks.manager.createTerminal).toBeInstanceOf(Function);
      expect(vi.isMockFunction(mocks.manager.createTerminal)).toBe(true);
      
      expect(get(mocks.sessions)).toEqual([]);
      expect(get(mocks.panes)).toBeInstanceOf(Map);
      expect(get(mocks.isConnected)).toBe(false);
    });
  });

  describe('waitForStoreUpdate', () => {
    it('should wait for store update matching predicate', async () => {
      const store = createMockWritable(0);
      
      setTimeout(() => {
        store.set(5);
      }, 10);
      
      const result = await waitForStoreUpdate(store, value => value === 5);
      expect(result).toBe(5);
    });

    it('should timeout if predicate never matches', async () => {
      const store = createMockWritable(0);
      
      await expect(
        waitForStoreUpdate(store, value => value === 999, 50)
      ).rejects.toThrow('Store update timeout');
    });
  });

  describe('Mock Data Factories', () => {
    it('should create valid mock session', () => {
      const session = createMockSession();
      expect(session.id).toBe('test-session');
      expect(session.name).toBe('Test Session');
      expect(session.panes).toEqual([]);
      expect(session.created_at).toBeDefined();
      expect(session.updated_at).toBeDefined();
    });

    it('should create valid mock pane', () => {
      const pane = createMockPane();
      expect(pane.id).toBe('test-pane');
      expect(pane.session_id).toBe('test-session');
      expect(pane.pane_type).toBe('Terminal');
      expect(pane.rows).toBe(24);
      expect(pane.cols).toBe(80);
      expect(pane.is_active).toBe(false);
    });

    it('should create valid mock plugin', () => {
      const plugin = createMockPlugin();
      expect(plugin.id).toBe('test-plugin');
      expect(plugin.name).toBe('Test Plugin');
      expect(plugin.capabilities).toEqual(['terminal', 'editor', 'search']);
      expect(plugin.loaded).toBe(false);
    });
  });
});