# Mock Factory Migration Guide

This guide shows how to fix TypeScript errors with `mockResolvedValue` in tests by using the mock factory utilities.

## Common Patterns

### Before (Type Errors)
```typescript
// ❌ Type error: mockResolvedValue may not exist
const mockInvoke = vi.fn();
mockInvoke.mockResolvedValue({ terminal_id: 'term-123' });

// ❌ Type error: return type not inferred
vi.mocked(invoke).mockResolvedValue(undefined);
```

### After (Type-Safe)
```typescript
import { createAsyncMock, createAsyncVoidMock } from './test/mock-factory';

// ✅ Type-safe async mock
const mockInvoke = createAsyncMock<[string, any?], any>();
mockInvoke.mockResolvedValue({ terminal_id: 'term-123' });

// ✅ Void async mock
const mockEmit = createAsyncVoidMock<[string, any?]>();
```

## Real Example: Terminal IPC Test

### Before
```typescript
import { vi } from 'vitest';
import { invoke, emit } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');

beforeEach(() => {
  // Type errors here
  vi.mocked(invoke).mockResolvedValue(undefined);
  vi.mocked(emit).mockResolvedValue(undefined);
});

it('should create terminal', async () => {
  const mockMetadata = { terminal_id: 'term-123' };
  // Type error: mockResolvedValue type not matching
  vi.mocked(invoke).mockResolvedValue(mockMetadata);
});
```

### After
```typescript
import { vi } from 'vitest';
import { createAsyncMock } from '@/test/mock-factory';
import type { InvokeCommand, EmitEvent } from '@/types/tauri';

// Create typed mocks
const mockInvoke = createAsyncMock<[InvokeCommand, any?], any>();
const mockEmit = createAsyncMock<[EmitEvent, any?], void>(undefined);

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
  emit: mockEmit
}));

beforeEach(() => {
  mockInvoke.mockClear();
  mockEmit.mockClear();
});

it('should create terminal', async () => {
  const mockMetadata = { terminal_id: 'term-123' };
  // Type-safe and no errors
  mockInvoke.mockResolvedValueOnce(mockMetadata);
  
  // Can also set up conditional responses
  mockInvoke.mockImplementation(async (cmd, args) => {
    switch (cmd) {
      case 'terminal:create':
        return mockMetadata;
      case 'terminal:stop':
        return undefined;
      default:
        throw new Error(`Unexpected command: ${cmd}`);
    }
  });
});
```

## Service Mock Example

### Before
```typescript
// Complex mocking with type issues
const mockService = {
  getUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn()
};

// Need to set up each mock individually
mockService.getUser.mockResolvedValue({ id: '1', name: 'John' });
mockService.updateUser.mockResolvedValue(undefined);
mockService.deleteUser.mockResolvedValue(true);
```

### After
```typescript
import { createMockObject, createAsyncMock, MockPatterns } from '@/test/mock-factory';

interface UserService {
  getUser(id: string): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<void>;
  deleteUser(id: string): Promise<boolean>;
}

// Create fully typed mock service
const mockService = createMockObject<UserService>({
  getUser: createAsyncMock({ id: '1', name: 'John' }),
  updateUser: MockPatterns.asyncSuccess(),
  deleteUser: createAsyncMock(true)
});
```

## Quick Reference

```typescript
// Import what you need
import {
  createAsyncMock,      // For async functions that return a value
  createAsyncVoidMock,  // For async functions that return void
  createSyncMock,       // For sync functions
  createMockObject,     // For objects with multiple methods
  MockPatterns,         // Common patterns
  createSequenceMock,   // Multiple return values
  createTypedMock,      // Type-first approach
} from '@/test/mock-factory';

// Common patterns
const voidAsync = MockPatterns.asyncSuccess();
const failingAsync = MockPatterns.asyncError('Error message');
const delayedAsync = MockPatterns.delayedMock(result, 100);

// Sequence of values
const mockApi = createAsyncSequenceMock([
  { status: 'pending' },
  { status: 'complete' }
]);
```

## Benefits

1. **Type Safety**: Full TypeScript support with proper inference
2. **Cleaner Tests**: Less boilerplate, more readable
3. **Reusable Patterns**: Common mock patterns built-in
4. **Better Errors**: Type errors caught at compile time
5. **Consistent API**: Same patterns across all tests