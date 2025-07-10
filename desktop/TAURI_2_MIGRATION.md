# Tauri 2.0 Migration Plan

## Overview
Migrating OrchFlow from Tauri 1.8 to Tauri 2.0 to resolve backend issues and leverage new features.

## Current State
- Tauri: 1.8.3 (was incorrectly listed as 1.5 in Cargo.toml)
- Frontend: @tauri-apps/api 1.5.0
- CLI: @tauri-apps/cli 1.5.0

## Migration Steps

### 1. Update Dependencies (Backend)
- [ ] Update tauri to 2.0
- [ ] Update tauri-build to 2.0
- [ ] Add required Tauri plugins

### 2. Migrate APIs to Plugins
APIs that need migration:
- [ ] Shell API → @tauri-apps/plugin-shell
- [ ] Process API → @tauri-apps/plugin-process
- [ ] FS API → @tauri-apps/plugin-fs
- [ ] OS API → @tauri-apps/plugin-os
- [ ] Path API → Built into core
- [ ] Updater → @tauri-apps/plugin-updater
- [ ] Window → Rename to WebviewWindow

### 3. Update Configuration
- [ ] Rename `tauri` key to `app` in tauri.conf.json
- [ ] Update allowlist to new plugin format
- [ ] Update environment variables

### 4. Code Changes
- [ ] Rename Window to WebviewWindow in Rust code
- [ ] Update imports for moved APIs
- [ ] Update error handling for new API structure

### 5. Frontend Updates
- [ ] Update @tauri-apps/api to 2.0
- [ ] Update @tauri-apps/cli to 2.0
- [ ] Install required plugin packages
- [ ] Update imports from /tauri to /core

### 6. Testing
- [ ] Test all terminal functionality
- [ ] Test file operations
- [ ] Test window management
- [ ] Test updater functionality

## Breaking Changes to Address

1. **Window → WebviewWindow**: All Window references need updating
2. **API Plugin Migration**: Core APIs moved to separate plugins
3. **Import Path Changes**: /tauri → /core in frontend
4. **Configuration Structure**: Major changes to tauri.conf.json

## Risk Mitigation
- Create backups before migration
- Test each component after migration
- Have rollback plan ready