// Mux Event Handler Service
// Handles events from the muxd backend

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { parseMuxdTimestamp } from '$lib/utils/timestamp';

export interface MuxUIEvent {
  type: 'PaneOutput' | 'PaneExit' | 'SessionCreated' | 'PaneCreated' | 'MuxError';
  pane_id?: string;
  session_id?: string;
  data?: string;
  exit_code?: number;
  name?: string;
  error?: string;
  context?: string;
  timestamp: string; // ISO string from backend
}

export interface MuxEventHandlers {
  onPaneOutput?: (paneId: string, data: string, timestamp: Date) => void;
  onPaneExit?: (paneId: string, exitCode: number | null, timestamp: Date) => void;
  onSessionCreated?: (sessionId: string, name: string, timestamp: Date) => void;
  onPaneCreated?: (paneId: string, sessionId: string, timestamp: Date) => void;
  onMuxError?: (error: string, context: string | null, timestamp: Date) => void;
}

class MuxEventHandlerService {
  private listeners: UnlistenFn[] = [];
  private isListening = false;

  /**
   * Start listening to mux events from the backend
   */
  async startListening(handlers: MuxEventHandlers): Promise<void> {
    if (this.isListening) {
      console.warn('MuxEventHandler is already listening');
      return;
    }

    this.isListening = true;

    // Listen for mux events
    const unlisten = await listen<MuxUIEvent>('mux-event', (event) => {
      const payload = event.payload;
      
      // Parse timestamp from backend
      const timestamp = parseMuxdTimestamp(payload.timestamp);
      if (!timestamp) {
        console.error('Invalid timestamp in mux event:', payload.timestamp);
        return;
      }

      switch (payload.type) {
        case 'PaneOutput':
          if (payload.pane_id && payload.data && handlers.onPaneOutput) {
            handlers.onPaneOutput(payload.pane_id, payload.data, timestamp);
          }
          break;

        case 'PaneExit':
          if (payload.pane_id && handlers.onPaneExit) {
            handlers.onPaneExit(payload.pane_id, payload.exit_code ?? null, timestamp);
          }
          break;

        case 'SessionCreated':
          if (payload.session_id && payload.name && handlers.onSessionCreated) {
            handlers.onSessionCreated(payload.session_id, payload.name, timestamp);
          }
          break;

        case 'PaneCreated':
          if (payload.pane_id && payload.session_id && handlers.onPaneCreated) {
            handlers.onPaneCreated(payload.pane_id, payload.session_id, timestamp);
          }
          break;

        case 'MuxError':
          if (payload.error && handlers.onMuxError) {
            handlers.onMuxError(payload.error, payload.context ?? null, timestamp);
          }
          break;

        default:
          console.warn('Unknown mux event type:', payload.type);
      }
    });

    this.listeners.push(unlisten);
  }

  /**
   * Stop listening to mux events
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    this.listeners.forEach(unlisten => unlisten());
    this.listeners = [];
    this.isListening = false;
  }

  /**
   * Subscribe to specific mux events with automatic cleanup
   * Returns an unsubscribe function
   */
  subscribe(handlers: MuxEventHandlers): () => void {
    // Start listening asynchronously, but don't wait
    this.startListening(handlers).catch(console.error);
    
    // Return unsubscribe function that will clean up listeners
    return () => {
      this.stopListening();
    };
  }
}

// Export singleton instance
export const muxEventHandler = new MuxEventHandlerService();

// Re-export timestamp parser for convenience
export { parseMuxdTimestamp };