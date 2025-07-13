# Pre-commit Hooks for Orchflow Desktop

This document describes the pre-commit hooks configured for the Orchflow Desktop project to ensure code quality and prevent common issues.

## 🎯 Overview

Pre-commit hooks automatically run quality checks before each commit, catching issues early and maintaining consistent code standards across the team.

## 🚀 Quick Start

### Installation

1. **Install pre-commit** (one-time setup):
   ```bash
   # Using pip
   pip install pre-commit
   
   # Using brew (macOS)
   brew install pre-commit
   
   # Using the provided script
   ./scripts/pre-commit-install.sh
   ```

2. **Install hooks** in the repository:
   ```bash
   pre-commit install
   ```

3. **Test the setup** (optional):
   ```bash
   pre-commit run --all-files
   ```

## 🔍 Configured Hooks

### Critical Quality Gates

These hooks **will block commits** if they fail:

#### 1. TypeScript Type Checking (`typescript-check`)
- **Purpose**: Ensures all TypeScript code compiles without errors
- **Command**: `npm run check`
- **Files**: `*.ts`, `*.tsx`, `*.svelte`
- **Why Critical**: Type errors can cause runtime failures

#### 2. ESLint with Auto-fix (`eslint-fix`)
- **Purpose**: Enforces code style and catches potential bugs
- **Command**: `npm run lint:fix`
- **Files**: `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.svelte`
- **Behavior**: Auto-fixes issues when possible, fails on unfixable errors

#### 3. Rust Compilation Check (`rust-check`)
- **Purpose**: Ensures Rust code compiles successfully
- **Command**: `cargo check`
- **Files**: `*.rs`
- **Why Critical**: Compilation errors break the build

#### 4. Rust Formatting (`rust-fmt`)
- **Purpose**: Enforces consistent Rust code formatting
- **Command**: `cargo fmt --all -- --check`
- **Files**: `*.rs`
- **Behavior**: Fails if code is not properly formatted

#### 5. Rust Clippy Lints (`rust-clippy`)
- **Purpose**: Catches common Rust mistakes and suggests improvements
- **Command**: `cargo clippy --all-targets --all-features -- -D warnings`
- **Files**: `*.rs`
- **Behavior**: Treats warnings as errors

### Code Formatting

#### 6. Prettier (`prettier`)
- **Purpose**: Enforces consistent code formatting
- **Files**: `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.json`, `*.yaml`, `*.md`
- **Behavior**: Auto-formats code

#### 7. Svelte Formatting (`svelte-format`)
- **Purpose**: Formats Svelte components consistently
- **Files**: `*.svelte`
- **Command**: `prettier --check --plugin prettier-plugin-svelte`

### Security & Quality

#### 8. Secret Detection (`detect-secrets`)
- **Purpose**: Prevents committing API keys, passwords, tokens
- **Files**: All files (with exclusions)
- **Behavior**: Scans for potential secrets

#### 9. Basic File Checks
- Trailing whitespace removal
- End-of-file fixers
- YAML/JSON/TOML syntax validation
- Merge conflict detection
- Large file detection (>1MB)
- Private key detection

## 🛠️ Usage

### Normal Workflow
Just commit as usual - hooks run automatically:
```bash
git add .
git commit -m "your commit message"
```

### Skip Hooks (Emergency Only)
```bash
git commit --no-verify -m "emergency fix"
```

### Run Hooks Manually
```bash
# Run on all files
pre-commit run --all-files

# Run specific hook
pre-commit run typescript-check

# Run on specific files
pre-commit run --files src/component.ts
```

### Update Hooks
```bash
pre-commit autoupdate
```

## 🔧 Configuration Files

- **`.pre-commit-config.yaml`**: Main configuration
- **`.prettierrc.json`**: Prettier formatting rules
- **`.prettierignore`**: Files to exclude from Prettier
- **`.secrets.baseline`**: Baseline for secret detection
- **`scripts/pre-commit-install.sh`**: Installation helper

## 📊 Performance Impact

Typical hook runtime on a medium-sized commit:
- TypeScript check: 5-15 seconds
- ESLint fix: 2-5 seconds
- Rust checks: 10-30 seconds
- Formatting: 1-3 seconds
- **Total**: ~20-60 seconds

## 🚨 Troubleshooting

### Common Issues

#### "TypeScript check failed"
```bash
# Fix type errors manually, then commit
npm run check
# Address errors shown
```

#### "ESLint errors"
```bash
# Auto-fix what's possible
npm run lint:fix
# Fix remaining errors manually
```

#### "Rust compilation failed"
```bash
# Check Rust errors
cargo check
# Fix compilation issues
```

#### "Hook failed to run"
```bash
# Update hooks
pre-commit autoupdate
# Reinstall
pre-commit install --force
```

### Bypassing Specific Hooks

Add to `.pre-commit-config.yaml`:
```yaml
- id: hook-name
  exclude: ^path/to/exclude/
```

## 🎛️ Customization

### Adding New Hooks

1. Edit `.pre-commit-config.yaml`
2. Add new hook configuration
3. Test with `pre-commit run --all-files`
4. Commit changes

### Adjusting Hook Behavior

Most hooks can be customized via:
- Command arguments in `.pre-commit-config.yaml`
- Configuration files (`.prettierrc.json`, `eslint.config.js`, etc.)
- Environment variables

## 📈 Benefits

✅ **Prevents broken builds** - Catch compilation errors before CI  
✅ **Maintains code quality** - Consistent style and best practices  
✅ **Saves CI time** - Fail fast on local machine  
✅ **Improves security** - Detect secrets before they're committed  
✅ **Reduces review time** - Automated formatting and basic checks  
✅ **Team consistency** - Same standards for everyone  

## 🔗 Related Documentation

- [ESLint Configuration](./ESLINT.md)
- [TypeScript Guidelines](./TYPESCRIPT.md)
- [Rust Development](./RUST.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

💡 **Pro Tip**: Run `pre-commit run --all-files` after major changes to ensure everything is clean before pushing!