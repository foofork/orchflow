# CommandConfirmationDialog Testing Strategy

## Problem Summary
The CommandConfirmationDialog component has complex dependencies on Modal and Icon components, making it difficult to test with traditional unit testing approaches. The Modal component in particular requires proper rendering to document.body and has specific behavior around the `show` prop.

## Testing Approach

### 1. Integration Tests (Recommended)
**File**: `CommandConfirmationDialog.integration.test.ts`

Integration tests provide the most reliable way to test this component because:
- They test the actual component behavior including Modal and Icon interactions
- They verify the complete user experience
- They don't require complex mocking

**Note**: Integration tests should render with `target: document.body` to properly test Modal behavior.

### 2. Unit Tests (Limited Scope)
**File**: `CommandConfirmationDialog.unit.test.ts`

Unit tests focus on:
- Component initialization and prop validation
- Event handler registration
- Prop updates

These tests use mocked components but cannot test internal methods or state directly due to Svelte's component encapsulation.

### 3. E2E Tests (Full Stack)
For the most comprehensive testing, consider E2E tests that:
- Test the dialog in a real browser environment
- Verify animations and transitions
- Test keyboard navigation and accessibility
- Ensure proper focus management

## Implementation Notes

### Modal Component Behavior
The Modal component:
- Only renders when `show` prop is true
- Requires `target: document.body` for proper rendering
- Manages its own overlay and content structure
- Handles escape key and overlay click events

### Testing Challenges
1. **Component Mocking**: Svelte components require specific internal structure (`$$`, `$set`, `$on`, etc.)
2. **Slot Content**: Modal uses slots which are difficult to test in isolation
3. **Transitions**: Svelte transitions are hard to test in JSDOM environment
4. **Event Propagation**: Complex event handling between Modal and CommandConfirmationDialog

### Recommendations
1. **Primary Testing**: Use integration tests with real components
2. **Unit Tests**: Keep them simple, focusing on prop validation
3. **Visual Testing**: Consider Storybook or similar for visual regression testing
4. **E2E Testing**: Add Cypress/Playwright tests for critical user flows

## Example Test Structure

```typescript
// Integration test example
describe('CommandConfirmationDialog Integration', () => {
  it('shows dialog with security warning', async () => {
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: mockWarning,
        terminalInfo: mockTerminalInfo
      },
      target: document.body // Important for Modal
    });
    
    await tick(); // Allow Svelte to update
    
    // Test actual rendered content
    expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
  });
});
```

## Migration Path
1. Keep the original test file with deprecation notice
2. Move complex interaction tests to integration tests
3. Keep simple prop tests in unit tests
4. Add E2E tests for critical security workflows