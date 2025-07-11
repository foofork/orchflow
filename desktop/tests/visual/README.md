# Visual Regression Testing

This directory contains visual regression tests for OrchFlow using Playwright and Percy.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Percy Setup (optional, for cloud-based visual testing):**
   - Sign up for a Percy account at https://percy.io
   - Create a new project
   - Set the PERCY_TOKEN environment variable:
     ```bash
     export PERCY_TOKEN=your_percy_token_here
     ```

## Running Tests

### Local Visual Tests (Playwright only)
```bash
# Run all visual tests
npm run test:visual

# Run tests in UI mode for debugging
npm run test:visual:ui

# Update baseline screenshots
npm run test:visual:update

# View test report
npm run test:visual:report
```

### Percy Visual Tests (Cloud-based)
```bash
# Run tests with Percy snapshots
npm run test:visual:percy
```

## Test Structure

- `app.spec.ts` - Overall application UI tests
- `terminal.spec.ts` - Terminal component visual tests
- `editor.spec.ts` - Editor component visual tests

## Writing Visual Tests

### Basic Playwright Screenshot
```typescript
await expect(page).toHaveScreenshot('screenshot-name.png', {
  fullPage: true,
  animations: 'disabled',
});
```

### Percy Snapshot
```typescript
import percySnapshot from '@percy/playwright';

await percySnapshot(page, 'Snapshot Name');
```

## Best Practices

1. **Disable Animations:** Always disable animations for consistent snapshots
2. **Wait for Content:** Ensure all content is loaded before taking snapshots
3. **Use Meaningful Names:** Give descriptive names to your snapshots
4. **Test Multiple Viewports:** Test responsive behavior across different screen sizes
5. **Hide Dynamic Content:** Hide timestamps, loading spinners, etc. that change between runs

## Configuration

- `playwright.config.ts` - Playwright configuration
- `.percy.yml` - Percy configuration

## Troubleshooting

### Flaky Tests
- Increase wait times for dynamic content
- Use `waitForLoadState('networkidle')` before snapshots
- Hide elements with dynamic content

### Different Results Locally vs CI
- Ensure same browser versions
- Use consistent viewport sizes
- Check font rendering settings

### Percy Issues
- Verify PERCY_TOKEN is set correctly
- Check Percy dashboard for build status
- Review Percy documentation for specific errors