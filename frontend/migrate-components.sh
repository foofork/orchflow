#!/bin/bash

# Migration script to swap old components with new v2 components

echo "Starting component migration..."

# Backup current files
echo "Creating backups..."
cp src/routes/+layout.svelte src/routes/+layout.svelte.bak
cp src/routes/+page.svelte src/routes/+page.svelte.bak

# Rename v2 files to replace originals
echo "Migrating layout files..."
mv src/routes/+layout-v2.svelte src/routes/+layout.svelte
mv src/routes/+page-v2.svelte src/routes/+page.svelte

echo "Migrating components..."
mv src/lib/components/Terminal-v2.svelte src/lib/components/Terminal.svelte
mv src/lib/components/CommandBar-v2.svelte src/lib/components/CommandBar.svelte
mv src/lib/components/TabBar-v2.svelte src/lib/components/TabBar.svelte
mv src/lib/components/StatusBar-v2.svelte src/lib/components/StatusBar.svelte
mv src/lib/components/Dashboard-v2.svelte src/lib/components/Dashboard.svelte

echo "Migrating stores..."
mv src/lib/stores/orchestrator-v2.ts src/lib/stores/orchestrator.ts

echo "Migrating API client..."
mv src/lib/api/tauri-orchestrator-client.ts src/lib/api/orchestrator-client.ts

echo "Migration complete!"
echo ""
echo "Next steps:"
echo "1. Update import paths in any components that weren't migrated"
echo "2. Remove old HTTP/WebSocket client code"
echo "3. Test the application"
echo ""
echo "To rollback, use the .bak files created in the process"