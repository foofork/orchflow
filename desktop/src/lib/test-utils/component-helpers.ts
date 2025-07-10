import { render, type RenderResult } from '@testing-library/svelte'
import { writable } from 'svelte/store'
import type { ComponentType } from 'svelte'

// Mock stores that components commonly use
export const mockStores = () => {
  const mockSettings = writable({
    theme: 'dark',
    fontSize: 14,
    fontFamily: 'monospace',
    tabSize: 2,
  })

  const mockFiles = writable({
    openFiles: [],
    activeFile: null,
    recentFiles: [],
  })

  const mockTerminals = writable({
    terminals: [],
    activeTerminalId: null,
  })

  const mockGit = writable({
    status: {
      modified: [],
      untracked: [],
      staged: [],
    },
    branch: 'main',
  })

  return {
    settings: mockSettings,
    files: mockFiles,
    terminals: mockTerminals,
    git: mockGit,
  }
}

// Helper to render components with common providers
export const renderWithProviders = (
  component: ComponentType,
  options: {
    props?: Record<string, any>
    stores?: Record<string, any>
  } = {}
): RenderResult => {
  const stores = options.stores || mockStores()

  // Set up context that components expect
  const context = new Map([
    ['settings', stores.settings],
    ['files', stores.files],
    ['terminals', stores.terminals],
    ['git', stores.git],
  ])

  return render(component, {
    ...options,
    context,
  })
}

// Helper to wait for animations/transitions
export const waitForAnimation = (ms: number = 300): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Helper to mock ResizeObserver
export const mockResizeObserver = () => {
  const ResizeObserverMock = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  
  return ResizeObserverMock
}

// Helper to mock IntersectionObserver
export const mockIntersectionObserver = () => {
  const IntersectionObserverMock = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
  
  return IntersectionObserverMock
}

// Helper to mock matchMedia
export const mockMatchMedia = (matches: boolean = false) => {
  const matchMediaMock = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  vi.stubGlobal('matchMedia', matchMediaMock)
  
  return matchMediaMock
}

// Helper to create a mock file structure
export const createMockFileTree = () => ({
  '/': {
    type: 'directory' as const,
    name: 'root',
    path: '/',
    children: {
      'src': {
        type: 'directory' as const,
        name: 'src',
        path: '/src',
        children: {
          'index.ts': {
            type: 'file' as const,
            name: 'index.ts',
            path: '/src/index.ts',
            content: 'console.log("Hello World")',
          },
          'app.ts': {
            type: 'file' as const,
            name: 'app.ts',
            path: '/src/app.ts',
            content: 'export const app = () => {}',
          },
        },
      },
      'package.json': {
        type: 'file' as const,
        name: 'package.json',
        path: '/package.json',
        content: '{"name": "test-project"}',
      },
    },
  },
})

// Helper to simulate keyboard shortcuts
export const triggerShortcut = async (
  element: HTMLElement,
  key: string,
  modifiers: {
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
  } = {}
) => {
  const event = new KeyboardEvent('keydown', {
    key,
    ...modifiers,
    bubbles: true,
    cancelable: true,
  })

  element.dispatchEvent(event)
  await waitForAnimation(50) // Small delay for event processing
}

// Helper to test focus management
export const expectFocusOrder = async (elements: HTMLElement[]) => {
  for (let i = 0; i < elements.length; i++) {
    expect(document.activeElement).toBe(elements[i])
    
    if (i < elements.length - 1) {
      // Tab to next element
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      })
      document.activeElement?.dispatchEvent(event)
      await waitForAnimation(50)
    }
  }
}

// Helper to mock API responses
export const mockApiResponse = <T>(data: T, delay: number = 100) => {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), delay)
  })
}

// Helper to test drag and drop
export const simulateDragAndDrop = async (
  source: HTMLElement,
  target: HTMLElement,
  dataTransfer: Partial<DataTransfer> = {}
) => {
  const dragStartEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer as DataTransfer,
  })

  const dragOverEvent = new DragEvent('dragover', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer as DataTransfer,
  })

  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer as DataTransfer,
  })

  source.dispatchEvent(dragStartEvent)
  await waitForAnimation(50)
  
  target.dispatchEvent(dragOverEvent)
  await waitForAnimation(50)
  
  target.dispatchEvent(dropEvent)
  await waitForAnimation(50)
}

// Export all helpers
export default {
  mockStores,
  renderWithProviders,
  waitForAnimation,
  mockResizeObserver,
  mockIntersectionObserver,
  mockMatchMedia,
  createMockFileTree,
  triggerShortcut,
  expectFocusOrder,
  mockApiResponse,
  simulateDragAndDrop,
}