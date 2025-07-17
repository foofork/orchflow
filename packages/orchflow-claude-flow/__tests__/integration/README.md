# OrchFlow Integration Tests

This directory contains comprehensive integration tests for the OrchFlow refactored components. These tests verify that all the consolidated and unified components work together correctly.

## Test Suite Overview

### 1. Unified Setup Tests (`unified-setup.test.ts`)
Tests the `UnifiedSetupOrchestrator` which combines features from both optimized and enhanced orchestrators.

**Coverage:**
- CLI entry points (basic and enhanced)
- Environment detection integration
- Configuration management
- Flow selection
- Performance tracking
- Error handling
- Setup validation

### 2. Tmux Wiring Tests (`tmux-wiring.test.ts`)
Tests the `TmuxInstaller` integration with the terminal initialization flow.

**Coverage:**
- Tmux installation and configuration
- Platform-specific installation flows
- Integration with UnifiedSetupOrchestrator
- Environment detection
- Configuration persistence
- Error recovery

### 3. MCP Registration Tests (`mcp-registration.test.ts`)
Tests MCP tool registration through the public API.

**Coverage:**
- Tool registration and discovery
- Built-in OrchFlow tools
- Tool execution
- Integration with OrchFlow core
- Error handling
- Performance under load

### 4. Manager Consolidation Tests (`manager-consolidation.test.ts`)
Tests the 5 core managers and their interactions.

**Coverage:**
- All 5 consolidated managers
- Cross-manager data flow
- Configuration propagation
- Worker lifecycle management
- Performance integration
- Error recovery

## Running the Tests

### All Integration Tests
```bash
npm run test:integration
```

### Using the Test Runner
```bash
# Run all tests with detailed reporting
npm run test:integration:runner

# Run a specific test suite
npm run test:integration:single unified-setup

# Validate test environment
npm run test:integration:validate
```

### Individual Test Suites
```bash
# Run specific test file
npx jest __tests__/integration/unified-setup.test.ts

# Run with coverage
npx jest __tests__/integration/unified-setup.test.ts --coverage
```

## Test Configuration

### Jest Configuration
The tests use a custom Jest configuration (`jest.config.js`) with:
- TypeScript support via ts-jest
- 60-second timeout for integration tests
- Coverage reporting
- Custom test environment setup

### Environment Setup
- `setup.ts`: Configures test environment and mocks
- `global-setup.ts`: Prepares directories and dependencies
- `global-teardown.ts`: Cleans up after tests

## Test Structure

Each test file follows this pattern:
1. **Setup/Teardown**: Initialize and clean up components
2. **Core Functionality**: Test main features
3. **Integration**: Test component interactions
4. **Error Handling**: Test failure scenarios
5. **Performance**: Test under load
6. **Edge Cases**: Test boundary conditions

## Test Data and Mocking

### Temporary Files
Tests create temporary files in:
- `temp/integration/`: Test data and configurations
- `logs/integration/`: Test logs
- `coverage/integration/`: Coverage reports

### Mocking Strategy
- External dependencies (tmux, inquirer) are mocked
- File system operations use temporary directories
- Network calls are mocked where appropriate
- Console output is suppressed in CI

## Performance Considerations

### Test Optimization
- Tests run in parallel where possible
- Shared setup/teardown for performance
- Mocked external dependencies
- Efficient cleanup

### Resource Management
- Proper cleanup of created resources
- Memory leak prevention
- Process cleanup

## Debugging Tests

### Verbose Output
```bash
npm run test:integration -- --verbose
```

### Debug Specific Test
```bash
npm run test:integration:single unified-setup --verbose
```

### Environment Validation
```bash
npm run test:integration:validate
```

## Common Issues and Solutions

### 1. Test Timeouts
- Default timeout is 60 seconds
- Increase timeout in `jest.config.js` if needed
- Check for hanging promises or processes

### 2. Mock Issues
- Ensure mocks are properly configured in `setup.ts`
- Clear mocks between tests
- Check mock implementations

### 3. File System Issues
- Ensure proper cleanup in teardown
- Check file permissions
- Verify temporary directory creation

### 4. Environment Issues
- Run environment validation first
- Check Node.js version (>=16.0.0)
- Verify all dependencies are installed

## Test Reports

### Generated Reports
- `coverage/integration/test-summary.json`: Machine-readable summary
- `coverage/integration/test-report.md`: Human-readable report
- `coverage/integration/junit.xml`: CI-compatible report

### Coverage Reports
- HTML coverage report in `coverage/integration/`
- LCOV format for CI integration
- Text summary in console output

## Continuous Integration

### CI Configuration
Tests are configured for CI environments:
- Reduced console output
- JUnit XML reporting
- Coverage reporting
- Fail-fast on errors

### CI Commands
```bash
# Full test suite for CI
npm run test:all

# Just integration tests
npm run test:integration

# With coverage
npm run test:integration -- --coverage
```

## Contributing

### Adding New Tests
1. Create test file in `__tests__/integration/`
2. Follow existing test patterns
3. Add to test runner configuration
4. Update this README

### Test Guidelines
- Use descriptive test names
- Include setup/teardown for each test
- Test both success and failure scenarios
- Mock external dependencies
- Clean up resources

### Best Practices
- Test one component at a time
- Use proper assertions
- Handle async operations correctly
- Provide meaningful error messages
- Document complex test scenarios

## Dependencies

### Required Dependencies
- jest: Testing framework
- ts-jest: TypeScript support
- jest-extended: Additional matchers
- jest-junit: XML reporting
- ts-node: TypeScript execution

### Optional Dependencies
- chalk: Colored console output
- ora: Loading spinners
- inquirer: Interactive prompts (mocked)

## Architecture

### Test Organization
```
__tests__/integration/
├── unified-setup.test.ts      # Setup orchestrator tests
├── tmux-wiring.test.ts        # Tmux installation tests
├── mcp-registration.test.ts   # MCP tool registration tests
├── manager-consolidation.test.ts # Manager interaction tests
├── test-runner.ts             # Custom test runner
├── jest.config.js             # Jest configuration
├── setup.ts                   # Test environment setup
├── global-setup.ts            # Global setup
├── global-teardown.ts         # Global cleanup
└── test-results-processor.js  # Results processing
```

### Component Coverage
- ✅ UnifiedSetupOrchestrator
- ✅ TmuxInstaller
- ✅ OrchFlowMCPServer
- ✅ ConfigurationManager
- ✅ ContextManager
- ✅ TerminalManager
- ✅ WorkerManager
- ✅ StatusPaneManager

## Maintenance

### Regular Tasks
- Update test dependencies
- Review test coverage
- Update mocks for API changes
- Clean up temporary files
- Review test performance

### Monitoring
- Track test execution time
- Monitor coverage metrics
- Check for flaky tests
- Review error patterns

This comprehensive test suite ensures that all refactored OrchFlow components work together correctly and maintain their functionality across changes.