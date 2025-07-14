/**
 * Type definitions for UpdateNotification component and its tests
 */

import type { UnlistenFn } from '@tauri-apps/api/event';

// Update status types
export interface UpdateStatus {
  available: boolean;
  version: string;
  notes?: string;
  pub_date?: string;
}

// Progress event type
export interface UpdateProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

// Event payload types
export interface UpdateAvailableEvent {
  type: 'update-available';
  payload: UpdateStatus;
}

export interface UpdateProgressEvent {
  type: 'update-progress';
  payload: UpdateProgress;
}

export interface UpdateDownloadedEvent {
  type: 'update-downloaded';
  payload: void;
}

export interface UpdateErrorEvent {
  type: 'update-error';
  payload: string;
}

// Union type for all update events
export type UpdateEvent = UpdateAvailableEvent | UpdateProgressEvent | UpdateDownloadedEvent | UpdateErrorEvent;

// Event handler type
export type UpdateEventHandler = (event: UpdateEvent) => void;

// Component props (if any)
export interface UpdateNotificationProps {
  // Currently no props, but keeping interface for future extensibility
}

// Component instance type
export interface UpdateNotificationComponent {
  // Currently no public methods, but keeping interface for future extensibility
}