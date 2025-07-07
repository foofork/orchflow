# Contributing to OrchFlow

First off, thank you for considering contributing to OrchFlow! It's people like you that make OrchFlow such a great tool.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [How Can I Contribute?](#how-can-i-contribute)
4. [Development Process](#development-process)
5. [Style Guidelines](#style-guidelines)
6. [Commit Guidelines](#commit-guidelines)
7. [Pull Request Process](#pull-request-process)
8. [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

### Our Standards

- **Be Respectful**: Treat everyone with respect. No harassment, discrimination, or hateful speech.
- **Be Collaborative**: Work together to resolve conflicts and assume good intentions.
- **Be Professional**: Keep discussions focused on improving the project.
- **Be Inclusive**: Welcome newcomers and help them get started.

## Getting Started

1. **Fork the Repository**
   ```bash
   # Fork via GitHub UI, then:
   git clone https://github.com/YOUR_USERNAME/orchflow.git
   cd orchflow/frontend
   git remote add upstream https://github.com/orchflow/orchflow.git
   ```

2. **Set Up Development Environment**
   ```bash
   npm install
   npm run setup:dev
   ```

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear Title**: Summarize the issue
- **Description**: What happened vs. what you expected
- **Steps to Reproduce**: Minimal steps to reproduce
- **Environment**: OS, OrchFlow version, relevant settings
- **Screenshots**: If applicable
- **Logs**: From `~/.config/com.orchflow.app/logs/`

**Bug Report Template**:
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Environment**
- OS: [e.g., macOS 14.0]
- OrchFlow Version: [e.g., 0.1.0]
- Rust Version: [if building from source]

**Additional context**
Any other relevant information.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Include:

- **Use Case**: Why is this enhancement needed?
- **Current Behavior**: What happens now?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other solutions you've considered

### Contributing Code

#### Good First Issues

Look for issues labeled:
- `good first issue` - Simple fixes perfect for beginners
- `help wanted` - More complex issues where we need help
- `documentation` - Documentation improvements

#### Areas We Need Help

- **Performance**: Optimization and benchmarking
- **Testing**: Increasing test coverage
- **Documentation**: Tutorials and guides
- **Accessibility**: Improving keyboard navigation and screen reader support
- **Platform Support**: Testing and fixes for different OS versions
- **Localization**: Translating the UI

## Development Process

### 1. Planning

Before starting significant work:

1. Check if an issue exists
2. Discuss your approach in the issue
3. Wait for maintainer feedback

### 2. Implementation

Follow the technical guidelines:

```bash
# Always work on a feature branch
git checkout -b feature/description

# Keep your branch updated
git fetch upstream
git rebase upstream/main

# Run tests frequently
npm test

# Check types
npm run check

# Test your changes
npm run tauri:dev
```

### 3. Testing

Write tests for your changes:

```typescript
// Unit test example
test('component behaves correctly', () => {
  const result = myFunction(input);
  expect(result).toBe(expected);
});

// E2E test example
it('user can complete workflow', () => {
  cy.visit('/');
  cy.performAction();
  cy.get('.result').should('be.visible');
});
```

### 4. Documentation

Update relevant documentation:
- API changes → Update `docs/API.md`
- New features → Update `README.md`
- Configuration → Update relevant guides

## Style Guidelines

### TypeScript/JavaScript

```typescript
// Use TypeScript strict mode
// Prefer const over let
// Use template literals for strings with variables
// Use optional chaining (?.) and nullish coalescing (??)

// Good
const greeting = `Hello, ${name}!`;
const value = data?.property ?? defaultValue;

// Bad
var greeting = "Hello, " + name + "!";
const value = data && data.property || defaultValue;
```

### Rust

```rust
// Follow standard Rust conventions
// Use clippy for linting
// Prefer Result<T, E> over panic!
// Document public APIs

// Good
pub fn process_data(input: &str) -> Result<String, Error> {
    // Implementation
}

// Bad
pub fn process_data(input: &str) -> String {
    // Might panic!
}
```

### CSS/Styling

```css
/* Use CSS variables for theming */
.component {
  background: var(--color-surface);
  color: var(--color-text);
  
  /* Use logical properties */
  margin-inline: 1rem;
  padding-block: 0.5rem;
}

/* Mobile-first responsive design */
@media (min-width: 768px) {
  .component {
    /* Desktop styles */
  }
}
```

### Component Structure

```svelte
<script lang="ts">
  // 1. Imports
  // 2. Props
  // 3. State
  // 4. Computed/Derived
  // 5. Lifecycle
  // 6. Functions
</script>

<!-- Simple, semantic HTML -->
<div class="component">
  <!-- Content -->
</div>

<style>
  /* Scoped styles */
</style>
```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format
```
type(scope): subject

body (optional)

footer (optional)
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or fixes
- `chore`: Build process or auxiliary tool changes

### Examples

```bash
# Feature
git commit -m "feat(terminal): add split pane support"

# Bug fix with issue reference
git commit -m "fix(editor): prevent crash on empty file

Closes #123"

# Breaking change
git commit -m "feat(api)!: redesign session management

BREAKING CHANGE: Session API has been completely redesigned.
Migration guide available in docs/migration.md"
```

## Pull Request Process

### Before Submitting

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**
   ```bash
   npm run check
   npm test
   npm run tauri:build
   ```

3. **Update documentation**
   - Add/update relevant docs
   - Update CHANGELOG.md

4. **Self-review**
   - Check for debugging code
   - Ensure consistent style
   - Verify no secrets are exposed

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented complex code
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests for my changes
- [ ] All new and existing tests pass

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #(issue number)
```

### Review Process

1. **Automated Checks**: CI must pass
2. **Code Review**: At least one maintainer approval
3. **Testing**: Manual testing by reviewer
4. **Merge**: Squash and merge to maintain clean history

### After Merge

- Delete your feature branch
- Pull the latest main
- Celebrate! 🎉

## Community

### Getting Help

- **Discord**: [Join our server](https://discord.gg/orchflow)
- **Discussions**: Use GitHub Discussions for questions
- **Issues**: For bugs and feature requests

### Staying Updated

- Watch the repository for updates
- Subscribe to our newsletter
- Follow [@orchflow](https://twitter.com/orchflow) on Twitter

### Recognition

Contributors are recognized in:
- Release notes
- Contributors page
- Annual contributor spotlight

## Development Tips

### Performance Testing

```bash
# Run performance benchmarks
npm run bench

# Profile with Chrome DevTools
npm run tauri:dev -- --inspect
```

### Debugging

```typescript
// Use conditional logging
if (import.meta.env.DEV) {
  console.log('Debug info:', data);
}

// Add performance markers
performance.mark('operation-start');
// ... operation ...
performance.mark('operation-end');
performance.measure('operation', 'operation-start', 'operation-end');
```

### Common Issues

**Build Failures**
```bash
# Clean and rebuild
cargo clean
rm -rf node_modules
npm install
npm run tauri:build
```

**Type Errors**
```bash
# Regenerate types
npm run check -- --force
```

## Thank You!

Your contributions make OrchFlow better for everyone. We appreciate your time and effort!

If you have questions, don't hesitate to ask. We're here to help you succeed.

Happy coding! 🚀