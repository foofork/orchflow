# OrchFlow Implementation Strategy

## Recommended Approach: Monorepo with Workspaces

Instead of cloning, transform the current repository into a Cargo workspace that maintains both the extracted crates AND the demo application. This gives us the best of both worlds.

## Repository Structure

```
orchflow/                           # Current repo transformed
├── Cargo.toml                     # Workspace root
├── crates/                        # Extracted modular crates
│   ├── orchflow-core/
│   ├── orchflow-terminal/
│   ├── orchflow-mux/
│   ├── orchflow-protocol/
│   ├── orchflow-security/
│   ├── orchflow-server/
│   └── orchflow-client/
├── demo/                          # Demo application
│   ├── Cargo.toml
│   ├── src/
│   └── ui/                       # Minimal Svelte UI
├── desktop/                       # Current desktop (archive)
│   └── ARCHIVED_README.md
└── examples/                      # Integration examples
    ├── lapce-plugin/
    ├── discord-bot/
    └── cli-tool/
```

## Migration Steps

### Phase 1: Setup Workspace (Day 1)
```bash
# 1. Create workspace Cargo.toml in root
cat > Cargo.toml << 'EOF'
[workspace]
members = [
    "crates/*",
    "demo",
]
resolver = "2"

[workspace.dependencies]
tokio = { version = "1.40", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
async-trait = "0.1"
EOF

# 2. Create crates directory structure
mkdir -p crates/{orchflow-core,orchflow-terminal,orchflow-mux,orchflow-protocol,orchflow-security}

# 3. Archive current desktop
mv desktop desktop-archived
echo "This directory contains the original OrchFlow IDE code" > desktop-archived/ARCHIVED_README.md
```

### Phase 2: Extract Core Components (Days 2-7)

```bash
# Extract terminal streaming
cp -r desktop-archived/src-tauri/src/terminal_stream/* crates/orchflow-terminal/src/

# Extract mux backend
cp -r desktop-archived/src-tauri/src/mux_backend/* crates/orchflow-mux/src/

# Extract and simplify Manager -> Orchestrator
# This requires manual work to remove IDE features
```

### Phase 3: Build Demo App (Days 8-14)

```toml
# demo/Cargo.toml
[package]
name = "orchflow-demo"
version = "0.1.0"

[dependencies]
orchflow-core = { path = "../crates/orchflow-core" }
orchflow-terminal = { path = "../crates/orchflow-terminal" }
orchflow-server = { path = "../crates/orchflow-server" }
tauri = { version = "2.0", features = ["api-all"] }
```

## Benefits of This Approach

### 1. **Continuous Evolution**
- Demo always uses latest crate versions
- Easy to test new features
- No synchronization issues

### 2. **Git History Preserved**
- All commits retained
- Can trace feature evolution
- Blame/attribution maintained

### 3. **Gradual Migration**
- No "big bang" rewrite
- Can migrate piece by piece
- Always have working code

### 4. **Single Source of Truth**
- One repo to maintain
- One CI/CD pipeline
- One issue tracker

### 5. **Easy Publishing**
```bash
# When ready to publish crates
cargo publish -p orchflow-protocol
cargo publish -p orchflow-terminal
# ... etc

# Demo can stay private or be published separately
```

## Development Workflow

### For Core Development
```bash
# Work on core functionality
cd crates/orchflow-core
cargo test
cargo bench

# Test integration with demo
cd ../../demo
cargo run
```

### For Demo Features
```bash
# Add new demo scenario
cd demo/src/scenarios
# Edit files...

# Demo automatically uses workspace crates
cargo run
```

### For New Integrations
```bash
# Create new example
mkdir examples/vscode-extension
cd examples/vscode-extension
# Develop using workspace crates
```

## Version Management

```toml
# Workspace dependencies ensure version consistency
[workspace.dependencies]
orchflow-core = { version = "0.1.0", path = "crates/orchflow-core" }
orchflow-terminal = { version = "0.1.0", path = "crates/orchflow-terminal" }

# Demo always uses workspace versions
[dependencies]
orchflow-core.workspace = true
orchflow-terminal.workspace = true
```

## Maintaining Demo Features

### Adding New Demo Scenarios
1. Add to `demo/src/scenarios/`
2. Update demo UI to include new button/option
3. Test with latest crate changes
4. Document in demo README

### Enhancing Demo UI
1. Keep UI minimal but effective
2. Focus on showing orchestration
3. Add only what demonstrates core value
4. Resist feature creep

### Demo-Specific Features
Some features might be demo-only:
```rust
// demo/src/demo_features.rs
pub mod demo {
    /// Mock AI responses for offline demos
    pub struct MockClaudeResponses;
    
    /// Pre-recorded terminal sessions
    pub struct RecordedSessions;
    
    /// Demo-specific visualizations
    pub struct OrchestrationVisualizer;
}
```

## CI/CD Pipeline

```yaml
name: OrchFlow CI

on: [push, pull_request]

jobs:
  test-crates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test all crates
        run: cargo test --workspace

  test-demo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build demo
        run: cd demo && cargo build
      - name: Run demo tests
        run: cd demo && cargo test

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test examples compile
        run: |
          cd examples/cli-tool && cargo check
          cd ../discord-bot && cargo check
```

## Publishing Strategy

### Crates (Public)
- Publish to crates.io
- Follow semver strictly
- Automated via CI on tags

### Demo (Multiple Options)
1. **GitHub Releases**: Binary downloads
2. **Docker Hub**: `orchflow/demo:latest`
3. **Web Demo**: Deploy to Vercel/Netlify
4. **Keep Private**: Internal use only

## Migration Checklist

- [ ] Create workspace structure
- [ ] Extract terminal crate
- [ ] Extract mux crate
- [ ] Create orchestrator from manager
- [ ] Build minimal demo UI
- [ ] Add Claude integration
- [ ] Create demo scenarios
- [ ] Test everything together
- [ ] Archive old desktop code
- [ ] Update documentation
- [ ] Setup CI/CD
- [ ] Plan first release

## Example: Adding a New Feature

```bash
# 1. Implement in core crate
cd crates/orchflow-core
# Add new orchestrator method

# 2. Add to demo
cd ../../demo
# Add UI button for new feature

# 3. Test together
cargo run

# 4. Everything evolves together!
```

This approach keeps everything in one place while achieving the modular architecture goals!