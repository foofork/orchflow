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

## 📊 Success Metrics & Validation

### Testing Coverage Goals
| Component | Current | Week 4 Target | Week 8 Target |
|-----------|---------|---------------|---------------|
| Overall Coverage | 26.91% | 60% | 80% |
| Store Tests | ✅ 100% | ✅ 100% | ✅ 100% |
| CodeMirror Tests | 55% | 85% | 95% |
| Terminal Components | 0% | 80% | 90% |
| Editor Components | 0% | 80% | 90% |

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

### Phase 1 (Immediate)
- [ ] Install @codemirror/lang-yaml package
- [ ] Migrate XTerm to scoped packages
- [ ] Standardize Tokio versions in Rust projects
- [ ] Resolve remaining 13 CodeMirror test failures
- [ ] Complete test infrastructure hardening

### Phase 2 (Testing Support)
- [ ] Update development tools (TypeScript, Vitest, etc.)
- [ ] Standardize Tauri ecosystem packages
- [ ] Implement terminal component testing (>80% coverage)
- [ ] Implement editor component testing (>80% coverage)
- [ ] Setup visual regression testing

### Phase 3 (Major Planning)
- [ ] Create Svelte 5 migration plan with breaking change analysis
- [ ] Assess Vite 6 upgrade requirements and plugin compatibility
- [ ] Implement advanced testing infrastructure (performance, mutation)
- [ ] Develop custom testing utilities and automation

### Phase 4 (Execution)
- [ ] Execute Svelte 5 migration with comprehensive testing
- [ ] Execute SvelteKit 2 migration with SSG validation
- [ ] Execute Vite 6 upgrade with performance optimization
- [ ] Achieve >80% test coverage across all components

---

**Priority**: Execute phases sequentially, with quality gates between each phase
**Timeline**: 8 weeks total, with potential for acceleration if testing goals are exceeded
**Success Criteria**: All upgrades complete, >80% test coverage, performance maintained or improved

*Last Updated: Current Date | Version: 1.0 | Owner: Development Team*