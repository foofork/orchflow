/**
 * Central export for all test utilities
 */

// Component test utilities
export * from './component-test-utils';

// Mock stores
export * from './mock-stores';

// Tauri mocks
export * from './mock-tauri';

// Accessibility utilities
export * from './accessibility-utils';

// Test fixtures
export * from './test-fixtures';

// Canvas utilities (existing)
export * from './canvas';

// Mock factory utilities
export * from './mock-factory';
export * from '../mock-factory';
export * from '../test-data-builders';

// Re-export commonly used testing functions
export { render, fireEvent, screen, waitFor, within } from '@testing-library/svelte';
export { vi, expect, describe, it, test, beforeEach, afterEach } from 'vitest';