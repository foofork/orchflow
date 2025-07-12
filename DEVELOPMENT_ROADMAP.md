# Orchflow Development Roadmap

## 🚨 Critical Build Errors - MUST FIX FIRST
- [ ] Fix invalid export 'G' in /api/ai/stream preventing build completion
- [ ] Fix "untrack" not exported from svelte/ssr build error
- [ ] Resolve empty vendor-core chunk generation issue

## 🔴 High Priority - Accessibility (40+ warnings)
- [ ] Add proper ARIA roles to interactive div elements with click handlers
- [ ] Add keyboard event handlers to clickable non-interactive elements
- [ ] Fix form label associations in SearchReplace component
- [ ] Fix noninteractive elements with tabIndex in Terminal component
- [ ] Add ARIA roles to divs with keydown handlers

## 🟡 Medium Priority - Code Quality
- [ ] Remove unused imports (UnlistenFn, placeholder, Extension, StateEffect)
- [ ] Fix unused CSS selectors in DashboardEnhanced and SettingsModal
- [ ] Update vulnerable cookie dependency (< 0.7.0)
- [ ] Fix GitPanel unused export property 'sessionId'
- [ ] Resolve dynamic/static import conflict for GitPanel

## 🟢 Low Priority - Optimizations
- [ ] Configure proper chunk splitting to avoid empty chunks
- [ ] Remove autofocus attributes for better accessibility
- [ ] Clean up stopPropagation patterns in modal components

## 🧪 Testing Infrastructure
- [ ] E2E tests running without port conflicts
- [ ] Visual regression tests configured and passing
- [ ] Create central MockRegistry class for all mocks
- [ ] Add reset and snapshot functionality
- [ ] Implement mock decorators for cleaner test syntax
- [ ] Audit current unit tests for integration test candidates
- [ ] Create integration tests for Tauri API interactions
- [ ] Add critical user journey e2e tests (5-10 flows)
- [ ] Move appropriate unit tests to integration tests (target: 35% integration)
- [ ] Enable mutation testing (Stryker) in CI pipeline
- [ ] Create comprehensive testing guide in docs/
- [ ] Add test complexity analysis tools
- [ ] Add performance regression detection
- [ ] Create performance testing dashboard

## 📋 Pending Verification
- [ ] Verify TerminalManager export (likely refactored to store pattern)
- [ ] Verify Component Prop Type Issues after TypeScript fixes
- [ ] Verify Playwright Type Issues for e2e configuration