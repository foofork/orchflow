#!/bin/bash

# Generate updater keys for Tauri
# This script generates the public/private key pair for the auto-updater

set -e

echo "🔐 Generating Tauri updater keys..."

# Create keys directory if it doesn't exist
mkdir -p keys

# Generate the private key
echo "Generating private key..."
if command -v tauri &> /dev/null; then
    tauri signer generate -w keys/updater-key.key
    echo "✅ Private key generated: keys/updater-key.key"
else
    echo "❌ Tauri CLI not found. Installing..."
    cargo install tauri-cli --version "^1.5"
    tauri signer generate -w keys/updater-key.key
    echo "✅ Private key generated: keys/updater-key.key"
fi

# Extract the public key
echo "Extracting public key..."
PUBLIC_KEY=$(head -2 keys/updater-key.key | tail -1)

echo ""
echo "🔑 Your updater keys:"
echo "Private key: keys/updater-key.key"
echo "Public key: $PUBLIC_KEY"
echo ""
echo "⚠️  Security notes:"
echo "1. Keep the private key (keys/updater-key.key) SECRET"
echo "2. Add it to GitHub Secrets as TAURI_PRIVATE_KEY"
echo "3. Update tauri.conf.json with the public key"
echo "4. Never commit the private key to version control"
echo ""

# Add to .gitignore if not already there
if ! grep -q "keys/" .gitignore 2>/dev/null; then
    echo "keys/" >> .gitignore
    echo "✅ Added keys/ to .gitignore"
fi

echo "📝 To use these keys:"
echo "1. Copy the private key content to GitHub Secrets as TAURI_PRIVATE_KEY"
echo "2. Replace the pubkey in tauri.conf.json with: $PUBLIC_KEY"
echo "3. Build and sign your releases with the GitHub Actions workflow"
echo ""
echo "🚀 Auto-updater is now ready to use!"