# Priority Components for Testing - Quick Reference

## 🔴 Phase 1: Critical Components (0% Coverage)

### 1. ActivityBar.svelte
```typescript
// Key test cases:
- Renders all menu items
- Handles active state changes
- Keyboard navigation (up/down arrows)
- Click events trigger navigation
- Accessibility: ARIA labels and roles
```

### 2. Modal.svelte
```typescript
// Key test cases:
- Opens and closes correctly
- ESC key closes modal
- Click outside closes modal
- Focus trap works
- Proper ARIA attributes
```

### 3. StatusBar.svelte
```typescript
// Key test cases:
- Displays all status items
- Updates dynamically
- Click handlers work
- Custom items can be added
- Responsive layout
```

### 4. Sidebar.svelte
```typescript
// Key test cases:
- Panel switching works
- Collapse/expand toggle
- Persists state
- Keyboard shortcuts
- Mobile responsive
```

### 5. CommandBar.svelte
```typescript
// Key test cases:
- Opens with keyboard shortcut
- Filters commands as you type
- Executes selected command
- Arrow key navigation
- ESC cancels
```

## 🟡 Phase 2: Enhance Existing Tests

### FileExplorer Components
**Missing Tests:**
- Drag and drop file operations
- Multi-select with Ctrl/Cmd
- Context menu operations
- File search within explorer
- Rename inline editing

### Terminal Components
**Missing Tests:**
- Multiple terminal sessions
- Terminal splitting
- Custom shell configuration
- Command history
- Copy/paste operations

### Editor Components
**Missing Tests:**
- Multi-cursor editing
- Find and replace
- Code folding
- Syntax highlighting
- Bracket matching

## 🟢 Phase 3: Component Integrations

### Critical User Flows to Test:
1. **File → Edit → Save → Git**
   - Open file from explorer
   - Make edits
   - Save (Ctrl+S)
   - See git status update

2. **Search → Replace → Save**
   - Global search
   - Preview replacements
   - Apply changes
   - Verify files updated

3. **Terminal → Editor Integration**
   - Click file path in terminal
   - Opens in editor
   - Error navigation

## Test Patterns to Use

### 1. Component Mounting Pattern
```typescript
import { render, screen } from '@testing-library/svelte'
import { mockStores } from '$lib/test-utils'

beforeEach(() => {
  mockStores() // Reset all stores
})

test('component renders', async () => {
  const { component } = render(MyComponent, {
    props: { /* props */ }
  })
  
  expect(screen.getByRole('button')).toBeInTheDocument()
})
```

### 2. User Interaction Pattern
```typescript
import { userEvent } from '@testing-library/user-event'

test('handles user clicks', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  
  render(Button, { props: { onClick } })
  
  await user.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledOnce()
})
```

### 3. Async Operations Pattern
```typescript
test('loads data asynchronously', async () => {
  const mockData = { items: [] }
  vi.mocked(api.getData).mockResolvedValue(mockData)
  
  render(DataList)
  
  expect(screen.getByText('Loading...')).toBeInTheDocument()
  
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
})
```

### 4. Keyboard Navigation Pattern
```typescript
test('supports keyboard navigation', async () => {
  const user = userEvent.setup()
  render(Menu)
  
  const firstItem = screen.getByRole('menuitem', { name: 'File' })
  await user.tab()
  
  expect(firstItem).toHaveFocus()
  
  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
})
```

### 5. Accessibility Pattern
```typescript
test('is accessible', async () => {
  const { container } = render(Dialog, {
    props: { open: true }
  })
  
  // Basic accessibility
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  
  // Full accessibility audit
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

## Quick Component Test Template

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import ComponentName from './ComponentName.svelte'

describe('ComponentName', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    // Setup mocks
  })

  describe('Rendering', () => {
    it('renders with default props', () => {
      render(ComponentName)
      expect(screen.getByRole('region')).toBeInTheDocument()
    })

    it('renders with custom props', () => {
      render(ComponentName, {
        props: { title: 'Custom Title' }
      })
      expect(screen.getByText('Custom Title')).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('handles click events', async () => {
      const handleClick = vi.fn()
      render(ComponentName, {
        props: { onClick: handleClick }
      })

      await user.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledOnce()
    })

    it('supports keyboard navigation', async () => {
      render(ComponentName)
      
      await user.tab()
      expect(screen.getByRole('button')).toHaveFocus()
      
      await user.keyboard('{Enter}')
      // Assert action was triggered
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(ComponentName)
      
      const element = screen.getByRole('region')
      expect(element).toHaveAttribute('aria-label')
      expect(element).toHaveAttribute('aria-describedby')
    })

    it('manages focus correctly', async () => {
      render(ComponentName, { props: { open: true } })
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles empty state', () => {
      render(ComponentName, { props: { items: [] } })
      expect(screen.getByText('No items found')).toBeInTheDocument()
    })

    it('handles errors gracefully', async () => {
      const onError = vi.fn()
      render(ComponentName, { props: { onError } })
      
      // Trigger error condition
      await user.click(screen.getByRole('button', { name: 'Trigger Error' }))
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) })
      )
    })
  })
})
```

## Effort Tracking

| Component | Priority | Estimated Hours | Status |
|-----------|----------|----------------|--------|
| ActivityBar | 🔴 High | 2h | Not Started |
| Modal | 🔴 High | 2h | Not Started |
| StatusBar | 🔴 High | 2h | Not Started |
| Sidebar | 🔴 High | 3h | Not Started |
| CommandBar | 🔴 High | 3h | Not Started |
| FileExplorer+ | 🟡 Medium | 4h | Partial |
| Terminal+ | 🟡 Medium | 4h | Partial |
| Editor+ | 🟡 Medium | 5h | Partial |
| Integrations | 🟢 Low | 10h | Not Started |

**Total Phase 1-2**: ~35 hours