import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { muxEventHandler } from '../mux-event-handler';
import * as tauriEvent from '@tauri-apps/api/event';

// Mock Tauri API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

// Mock timestamp parser
vi.mock('$lib/utils/timestamp', () => ({
  parseMuxdTimestamp: vi.fn((timestamp) => {
    if (timestamp === 'invalid') return null;
    return new Date(timestamp);
  }),
}));

describe('MuxEventHandler', () => {
  const mockListen = vi.mocked(tauriEvent.listen);
  let mockUnlisten: ReturnType<typeof vi.fn>;
  let eventHandlers: Map<string, (event: any) => void> = new Map();

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers.clear();
    mockUnlisten = vi.fn();
    
    mockListen.mockImplementation(async (eventName: string, handler: (event: any) => void) => {
      eventHandlers.set(eventName, handler);
      return mockUnlisten;
    });
  });

  afterEach(() => {
    muxEventHandler.stopListening();
  });

  describe('startListening', () => {
    it('should register listener for mux-event', async () => {
      const handlers = {
        onPaneOutput: vi.fn(),
      };

      await muxEventHandler.startListening(handlers);

      expect(mockListen).toHaveBeenCalledWith('mux-event', expect.any(Function));
    });

    it('should warn if already listening', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const handlers = {
        onPaneOutput: vi.fn(),
      };

      await muxEventHandler.startListening(handlers);
      await muxEventHandler.startListening(handlers);

      expect(consoleSpy).toHaveBeenCalledWith('MuxEventHandler is already listening');
      consoleSpy.mockRestore();
    });
  });

  describe('event handling', () => {
    it('should handle PaneOutput events', async () => {
      const onPaneOutput = vi.fn();
      await muxEventHandler.startListening({ onPaneOutput });

      const handler = eventHandlers.get('mux-event');
      const timestamp = '2024-01-01T12:00:00Z';
      handler?.({
        payload: {
          type: 'PaneOutput',
          pane_id: 'pane1',
          data: 'Hello World',
          timestamp,
        },
      });

      expect(onPaneOutput).toHaveBeenCalledWith(
        'pane1',
        'Hello World',
        new Date(timestamp)
      );
    });

    it('should handle PaneExit events', async () => {
      const onPaneExit = vi.fn();
      await muxEventHandler.startListening({ onPaneExit });

      const handler = eventHandlers.get('mux-event');
      const timestamp = '2024-01-01T12:00:00Z';
      handler?.({
        payload: {
          type: 'PaneExit',
          pane_id: 'pane1',
          exit_code: 0,
          timestamp,
        },
      });

      expect(onPaneExit).toHaveBeenCalledWith(
        'pane1',
        0,
        new Date(timestamp)
      );
    });

    it('should handle PaneExit with null exit code', async () => {
      const onPaneExit = vi.fn();
      await muxEventHandler.startListening({ onPaneExit });

      const handler = eventHandlers.get('mux-event');
      const timestamp = '2024-01-01T12:00:00Z';
      handler?.({
        payload: {
          type: 'PaneExit',
          pane_id: 'pane1',
          timestamp,
        },
      });

      expect(onPaneExit).toHaveBeenCalledWith(
        'pane1',
        null,
        new Date(timestamp)
      );
    });

    it('should handle SessionCreated events', async () => {
      const onSessionCreated = vi.fn();
      await muxEventHandler.startListening({ onSessionCreated });

      const handler = eventHandlers.get('mux-event');
      const timestamp = '2024-01-01T12:00:00Z';
      handler?.({
        payload: {
          type: 'SessionCreated',
          session_id: 'session1',
          name: 'Test Session',
          timestamp,
        },
      });

      expect(onSessionCreated).toHaveBeenCalledWith(
        'session1',
        'Test Session',
        new Date(timestamp)
      );
    });

    it('should handle PaneCreated events', async () => {
      const onPaneCreated = vi.fn();
      await muxEventHandler.startListening({ onPaneCreated });

      const handler = eventHandlers.get('mux-event');
      const timestamp = '2024-01-01T12:00:00Z';
      handler?.({
        payload: {
          type: 'PaneCreated',
          pane_id: 'pane1',
          session_id: 'session1',
          timestamp,
        },
      });

      expect(onPaneCreated).toHaveBeenCalledWith(
        'pane1',
        'session1',
        new Date(timestamp)
      );
    });

    it('should handle MuxError events', async () => {
      const onMuxError = vi.fn();
      await muxEventHandler.startListening({ onMuxError });

      const handler = eventHandlers.get('mux-event');
      const timestamp = '2024-01-01T12:00:00Z';
      handler?.({
        payload: {
          type: 'MuxError',
          error: 'Connection failed',
          context: 'WebSocket',
          timestamp,
        },
      });

      expect(onMuxError).toHaveBeenCalledWith(
        'Connection failed',
        'WebSocket',
        new Date(timestamp)
      );
    });

    it('should handle MuxError with null context', async () => {
      const onMuxError = vi.fn();
      await muxEventHandler.startListening({ onMuxError });

      const handler = eventHandlers.get('mux-event');
      const timestamp = '2024-01-01T12:00:00Z';
      handler?.({
        payload: {
          type: 'MuxError',
          error: 'Unknown error',
          timestamp,
        },
      });

      expect(onMuxError).toHaveBeenCalledWith(
        'Unknown error',
        null,
        new Date(timestamp)
      );
    });

    it('should skip events with invalid timestamps', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onPaneOutput = vi.fn();
      await muxEventHandler.startListening({ onPaneOutput });

      const handler = eventHandlers.get('mux-event');
      handler?.({
        payload: {
          type: 'PaneOutput',
          pane_id: 'pane1',
          data: 'Hello',
          timestamp: 'invalid',
        },
      });

      expect(onPaneOutput).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid timestamp in mux event:',
        'invalid'
      );
      consoleSpy.mockRestore();
    });

    it('should warn on unknown event types', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await muxEventHandler.startListening({});

      const handler = eventHandlers.get('mux-event');
      handler?.({
        payload: {
          type: 'UnknownEvent',
          timestamp: '2024-01-01T12:00:00Z',
        },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Unknown mux event type:',
        'UnknownEvent'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('stopListening', () => {
    it('should call unlisten functions', async () => {
      await muxEventHandler.startListening({});
      muxEventHandler.stopListening();

      expect(mockUnlisten).toHaveBeenCalled();
    });

    it('should do nothing if not listening', () => {
      muxEventHandler.stopListening();
      expect(mockUnlisten).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should start listening and return unsubscribe function', async () => {
      const handlers = {
        onPaneOutput: vi.fn(),
      };

      const unsubscribe = muxEventHandler.subscribe(handlers);
      
      // Wait for the async startListening to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockListen).toHaveBeenCalled();

      unsubscribe();
      expect(mockUnlisten).toHaveBeenCalled();
    });
  });
});