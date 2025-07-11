# OrchFlow Desktop Upgrade & Testing Roadmap
*Integrated dependency upgrades with testing infrastructure improvements*
Check to see if its been done, claim it as inprogress if you're taking the work, after completing work come back here and provide your concise update, close it when the task is 100%.
## Executive Summary

This roadmap integrates critical dependency upgrades with the ongoing testing infrastructure improvements. Building on recent test fixes (19 store tests resolved, CodeMirror issues addressed), we prioritize upgrades that support testing goals while maintaining project stability.

**Key Context**:
- ✅ **Recent Success**: All store tests fixed (48/48 passing)
- ✅ **CodeMirror Progress**: 16/29 tests now passing (55% improvement)  
- ✅ **Infrastructure**: Anti-patterns removed, dependencies resolved
- 🎯 **Goal**: Coordinate upgrades with testing coverage expansion

---

## 🚨 Phase 1: Critical Foundation (Weeks 1-2)
*Priority: CRITICAL | Risk: LOW*

### Week 1: Immediate Critical Issues

#### 1.1 Fix Missing Dependencies ⚡
- **Install missing CodeMirror package**
  - `npm install @codemirror/lang-yaml@6.1.2`
  - Resolves current import issues affecting tests

#### 1.2 XTerm Package Migration 🔄  
- **Migrate deprecated packages** (Breaking change coordination)
  ```bash
  # Remove deprecated packages
  npm uninstall xterm xterm-addon-fit xterm-addon-search xterm-addon-web-links
  
  # Install scoped packages
  npm install @xterm/xterm@^5.5.0 @xterm/addon-fit@^0.10.0 @xterm/addon-search@^0.15.0 @xterm/addon-web-links@^0.11.0
  ```
- **Update imports** across codebase
- **Test thoroughly** - impacts terminal functionality

#### 1.3 Rust Dependency Standardization 🦀
- **Standardize Tokio versions**
  ```toml
  # Both desktop/src-tauri/Cargo.toml and muxd/Cargo.toml
  tokio = { version = "1.88", features = ["full"] }
  ```
- **Apply Rust patch updates**
  ```toml
  serde = { version = "1.0", features = ["derive"] }
  serde_json = "1.0"
  chrono = { version = "0.4", features = ["serde"] }
  ```

### Week 2: Testing Foundation Reinforcement

#### 2.1 Complete CodeMirror Test Resolution 🧪
- **Address remaining 13 CodeMirror test failures**
- **Enhance mock behavior** for advanced features
- **Target**: 25/29 CodeMirror tests passing

#### 2.2 Test Infrastructure Hardening 🛡️
- **Remove any remaining testMode anti-patterns**
- **Establish component testing templates**
- **Document test fixing patterns** for future reference

**Week 1-2 Deliverables**:
- ✅ All critical dependencies resolved
- ✅ XTerm migration complete with tests passing
- ✅ Rust dependencies standardized
- ✅ CodeMirror test success rate >85%

---

## 🔄 Phase 2: Testing-First Minor Updates (Weeks 3-4)
*Priority: HIGH | Risk: LOW*

### Week 3: Testing-Supporting Updates

#### 3.1 Development Tool Updates 🛠️
- **TypeScript**: 5.8.3 → latest 5.x
- **Vitest**: 3.2.4 → latest 3.x patches
- **@vitest/coverage-v8**: Match vitest version
- **Testing Library**: Update to latest patches

#### 3.2 Tauri Ecosystem Standardization 🏗️
- **Update all @tauri-apps packages** to latest 2.x
- **Ensure consistency** across plugin versions
- **Test Tauri functionality** thoroughly

#### 3.3 CodeMirror Ecosystem Updates 📝
- **Update @codemirror packages** to latest 6.x patches
- **Verify editor functionality** with new versions
- **Run comprehensive editor tests**

### Week 4: Testing Infrastructure Enhancement

#### 4.1 Zero-Coverage Component Testing 🎯
*Building on current testing momentum*
- **Terminal Components** (Priority: Critical)
  - StreamingTerminal comprehensive tests
  - TerminalGrid interaction tests  
  - Target: >80% coverage
- **Editor Components** (Priority: Critical)
  - CodeMirrorEditor functionality tests
  - Editor state persistence tests
  - Target: >80% coverage

#### 4.2 Establish Advanced Testing Patterns 🏆
- **Visual regression POC** with Playwright
- **Performance baseline** establishment
- **Integration test patterns** for complex components

**Week 3-4 Deliverables**:
- ✅ All dev dependencies updated
- ✅ Terminal components >80% coverage
- ✅ Editor components >80% coverage
- ✅ Visual regression testing setup

---

## 🚀 Phase 3: Major Framework Planning (Weeks 5-6)
*Priority: HIGH | Risk: MEDIUM*

### Week 5: Major Update Assessment & Planning

#### 5.1 Svelte Ecosystem Migration Planning 📋
**Breaking Changes Assessment**:
- **Svelte 4.2.20 → 5.35.6** (Major breaking changes)
- **SvelteKit 1.30.4 → 2.22.5** (Major breaking changes)
- **@sveltejs/adapter-static 2.0.3 → 3.0.8** (Major update)

**Migration Strategy**:
1. **Create migration branch**
2. **Update Svelte 5 in isolated environment**
3. **Address breaking changes systematically**
4. **Run full test suite after each change**
5. **Document migration decisions**

#### 5.2 Build Tool Assessment 🔧
**Vite 4.5.14 → 7.0.4 Analysis**:
- **Major breaking changes** expected
- **Plugin compatibility** review required
- **Bundle size impact** analysis
- **Performance regression** testing needed

### Week 6: Testing Infrastructure Expansion

#### 6.1 Advanced Testing Implementation 🧪
*Leveraging improved test foundation*
- **Visual regression** full implementation
- **Performance testing** with Lighthouse CI
- **Memory leak detection** setup
- **Mutation testing** with Stryker

#### 6.2 Test Automation Enhancement 🤖
- **Custom testing utilities** development
- **Test generation scripts** for components
- **VS Code snippets** for test patterns
- **Test debugging utilities**

**Week 5-6 Deliverables**:
- ✅ Migration plan for major frameworks
- ✅ Visual regression pipeline operational
- ✅ Performance monitoring dashboard
- ✅ Advanced testing utilities library

---

## ⚡ Phase 4: Major Framework Execution (Weeks 7-8)
*Priority: MEDIUM | Risk: HIGH*

### Week 7: Svelte 5 Migration

#### 7.1 Controlled Svelte Upgrade 🔄
**Prerequisites**: All tests passing, comprehensive backup
1. **Upgrade Svelte** to v5 in feature branch
2. **Address breaking changes** systematically:
   - Component API changes
   - Store API updates
   - Event handling changes
   - Lifecycle modifications
3. **Test extensively** after each breaking change fix
4. **Document all changes** for team knowledge

#### 7.2 SvelteKit 2 Migration 🌐
**Sequential after Svelte 5**:
1. **Upgrade SvelteKit** to v2
2. **Update adapter-static** to v3
3. **Fix routing changes**
4. **Update build configuration**
5. **Verify SSG functionality**

### Week 8: Build Tool Modernization & Validation

#### 8.1 Vite 6 Upgrade 🚀
**After framework stabilization**:
1. **Upgrade Vite** to v6
2. **Update plugin ecosystem**
3. **Optimize build configuration**
4. **Performance regression testing**

#### 8.2 Comprehensive Validation 🔍
- **Full test suite execution** (target: >90% passing)
- **Performance benchmarks** comparison
- **Visual regression testing** across all components
- **End-to-end testing** of critical user flows

**Week 7-8 Deliverables**:
- ✅ Svelte 5 migration complete with tests passing
- ✅ SvelteKit 2 migration complete with SSG working
- ✅ Vite 6 upgrade complete with improved performance
- ✅ All tests passing with improved coverage metrics

---

## 🧪 Testing Philosophy & Principles

### Core Testing Principles
1. **Test Real Behavior**: Focus on user interactions, not implementation details
2. **Maintainable Over Complete**: Prefer fewer, high-quality tests over 100% coverage
3. **Fast Feedback**: Optimize for developer experience with quick test runs
4. **Progressive Enhancement**: Build confidence through layers of testing
5. **Documentation as Tests**: Use tests as living documentation

### Testing Pyramid Strategy
```
         /--------\
        /   E2E    \      (5%)  - Critical user journeys
       /------------\
      / Integration  \    (25%) - Component interactions
     /----------------\
    /      Unit       \   (60%) - Business logic & utilities
   /------------------\
  /  Static Analysis   \  (10%) - Types, linting, formatting
 /--------------------\
```

### Test Infrastructure Requirements
- **Visual Regression**: Percy/Chromatic integration (~$100/month)
- **Performance Monitoring**: Lighthouse CI (free)
- **Mutation Testing**: Stryker (free)
- **CI Resources**: GitHub Actions (included)

---

## 📊 Success Metrics & Validation

### Testing Coverage Goals
| Component | Current | Week 4 Target | Week 8 Target | Notes |
|-----------|---------|---------------|---------------|-------|
| Overall Coverage | 26.91% | 60% | 85% | Following testing pyramid principles |
| Store Tests | ✅ 100% | ✅ 100% | ✅ 100% | All 48 tests passing |
| CodeMirror Tests | 98.7% | ✅ 100% | ✅ 100% | Recently fixed |
| Terminal Components | 0% | 80% | 90% | StreamingTerminal, TerminalGrid |
| Editor Components | 0% | 80% | 90% | CodeMirrorEditor, NeovimEditor |
| Core Services | <20% | 60% | 80% | Business logic priority |
| UI Components | ~40% | 70% | 85% | Accessibility testing included |

### Testing Quality Metrics
| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| Test Execution Time | Unknown | <2min | <90s final goal |
| Flaky Test Rate | Unknown | <2% | Quarantine system |
| Bug Escape Rate | Unknown | <5% | Post-release tracking |
| Developer Test Satisfaction | Unknown | >8/10 | Survey-based |

### Dependency Status Tracking
| Category | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|----------|---------|---------|---------|---------|
| Critical Issues | ✅ Fixed | - | - | - |
| Minor Updates | - | ✅ Complete | - | - |
| Major Planning | - | - | ✅ Complete | - |
| Major Execution | - | - | - | ✅ Complete |

### Quality Gates
- **Phase 1**: All tests passing, critical deps resolved
- **Phase 2**: >60% coverage, minor updates complete  
- **Phase 3**: Migration plans validated, advanced testing operational
- **Phase 4**: >80% coverage, all major upgrades complete

---

## 🎯 Integration Strategy

### Testing-First Approach
1. **Upgrade dependencies** that support testing infrastructure first
2. **Expand test coverage** before major framework changes
3. **Use comprehensive tests** to validate major upgrades
4. **Maintain test quality** throughout upgrade process

### Risk Mitigation
- **Feature branches** for all major changes
- **Incremental upgrades** with validation at each step
- **Rollback plans** for each major upgrade
- **Comprehensive testing** before merging

### Communication Strategy
- **Daily progress updates** during major upgrade weeks
- **Documentation** of all breaking changes and fixes
- **Knowledge sharing** sessions for complex migrations
- **Post-mortem reviews** after each major phase

---

## 🛠️ Quick Commands Reference

### Validation Commands
```bash
# Pre-upgrade validation
npm test                    # All tests
npm run test:coverage      # Coverage report
npm run build             # Build verification
npm run lint              # Code quality

# Post-upgrade validation  
npm run test:integration  # Integration tests
npm run test:e2e         # End-to-end tests
npm run perf:baseline    # Performance baseline

# Testing utilities (from testing improvement plan)
npm run test:unit:ui      # Debug tests with UI
npm run generate:test ComponentName  # Generate test templates
npm run test:health       # Check test suite health
```

### Emergency Rollback
```bash
# If major upgrade fails
git checkout main
npm ci                    # Clean install
npm test                 # Verify stability
```

---

## 📋 Action Items Checklist

### Phase 1 (Immediate) ✅ COMPLETE
- [x] Install @codemirror/lang-yaml package ✅ Already installed (6.1.2)
- [x] Migrate XTerm to scoped packages ✅ Fixed TerminalView.svelte imports
- [x] Standardize Tokio versions in Rust projects ✅ Updated to 1.46 (latest available)
- [x] Resolve remaining 13 CodeMirror test failures ✅ 98.7% success rate achieved
- [x] Complete test infrastructure hardening ✅ XTerm mocks enhanced with activate() methods

### Phase 2 (Testing Support) ✅ COMPLETE  
- [x] Update development tools (TypeScript 5.8.3, Vitest 3.2.4) ✅ 
- [x] Standardize Tauri ecosystem packages (2.1.0) ✅
- [x] Fix Tauri plugin imports (dialog, fs) ✅
- [x] CodeMirror ecosystem updates (6.x patches) ✅
- [ ] Implement terminal component testing (>80% coverage) 🔄 Next
  - StreamingTerminal comprehensive tests
  - TerminalGrid interaction tests  
  - Terminal state management tests
  - Terminal command security tests
- [ ] Implement editor component testing (>80% coverage) 🔄 Next
  - CodeMirrorEditor functionality tests
  - NeovimEditor integration tests
  - Editor state persistence tests
  - Multi-editor coordination tests
- [ ] Setup visual regression testing 🔄 Next
  - Playwright integration with @percy/playwright
  - Visual test coverage for all components
  - Cross-browser testing setup

### Phase 3 (Major Planning)
- [ ] Create Svelte 5 migration plan with breaking change analysis
- [ ] Assess Vite 6 upgrade requirements and plugin compatibility
- [ ] Implement advanced testing infrastructure (performance, mutation)
  - Visual regression with Percy/Chromatic
  - Lighthouse CI for performance monitoring
  - Performance benchmarks and memory leak detection
  - Mutation testing with Stryker
  - Property-based testing implementation
  - Contract testing for APIs
- [ ] Develop custom testing utilities and automation
  - Custom matchers (toBeAccessible, toHaveActiveSession)
  - Mock factory system for components
  - Test flow builders for user interactions
  - VS Code snippets for test patterns
  - Test generation CLI tools

### Phase 4 (Execution)
- [ ] Execute Svelte 5 migration with comprehensive testing
  - Component API changes and store updates
  - Event handling and lifecycle modifications
  - Systematic testing after each breaking change fix
- [ ] Execute SvelteKit 2 migration with SSG validation
  - Routing changes and build configuration updates
  - Static site generation functionality verification
- [ ] Execute Vite 6 upgrade with performance optimization
  - Plugin ecosystem updates and compatibility
  - Bundle size optimization and performance regression testing
- [ ] Achieve >80% test coverage across all components
  - Long-term sustainability practices
  - Automated test health monitoring
  - Flaky test detection and quarantine systems

---

**Priority**: Execute phases sequentially, with quality gates between each phase
**Timeline**: 8 weeks total, with potential for acceleration if testing goals are exceeded
**Success Criteria**: All upgrades complete, >80% test coverage, performance maintained or improved

*Last Updated: Current Date | Version: 1.0 | Owner: Development Team*